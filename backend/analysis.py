"""As-of forecast selection and hourly, paired evaluation. All calculations are MW."""
import gzip
import json
import math
from bisect import bisect_right
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "elexon-jan2026.json.gz"
UTC = timezone.utc


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def iso(value):
    return value.isoformat().replace("+00:00", "Z")


def quantile(values, probability):
    """Linear interpolation between adjacent ordered observations (type 7)."""
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    return ordered[lower] + (ordered[math.ceil(position)] - ordered[lower]) * (position - lower)


class WindData:
    def __init__(self, payload):
        self.retrieved_at = payload["retrievedAt"]
        self.forecasts = self.index(payload["forecasts"])
        self.actuals = self.index(payload["actuals"])
        self.counts = {"forecastRows": len(payload["forecasts"]), "actualRows": len(payload["actuals"])}

    @staticmethod
    def index(rows):
        indexed = defaultdict(dict)
        for row in rows:
            start, publish = timestamp(row["startTime"]), timestamp(row["publishTime"])
            value = row["generation"]
            if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError("Invalid generation in data snapshot")
            if publish in indexed[start] and indexed[start][publish] != value:
                raise ValueError("Conflicting generation at identical start/publish times")
            indexed[start][publish] = value
        return {start: sorted(versions.items()) for start, versions in indexed.items()}

    @staticmethod
    def latest(index, start, cutoff=None):
        versions = index.get(start, [])
        if not versions:
            return None
        position = len(versions) - 1 if cutoff is None else bisect_right(versions, (cutoff, math.inf)) - 1
        return versions[position] if position >= 0 else None

    def day(self, decision, clock):
        cutoff = datetime.combine(decision, time.fromisoformat(clock), UTC)
        delivery = decision + timedelta(days=1)
        rows = []
        for hour in range(24):
            start = datetime.combine(delivery, time(hour), UTC)
            forecast = self.latest(self.forecasts, start, cutoff)
            halves = [self.latest(self.actuals, start + timedelta(minutes=m)) for m in (0, 30)]
            actual = sum(row[1] for row in halves) / 2 if all(halves) else None
            actual_published = max(row[0] for row in halves) if all(halves) else None
            rows.append({
                "startTime": iso(start), "hour": start.strftime("%H:%M"),
                "forecastMw": forecast[1] if forecast else None,
                "publishTime": iso(forecast[0]) if forecast else None,
                "leadHours": (start - forecast[0]).total_seconds() / 3600 if forecast else None,
                "actualMw": actual, "actualPublishTime": iso(actual_published) if actual_published else None,
                "errorMw": forecast[1] - actual if forecast and actual is not None else None,
            })
        return rows


@lru_cache(maxsize=1)
def dataset():
    with gzip.open(DATA, "rt", encoding="utf-8") as source:
        return WindData(json.load(source))


def metrics(rows):
    paired = [row for row in rows if row["errorMw"] is not None]
    errors = [row["errorMw"] for row in paired]
    n = len(errors)
    actual_sum = sum(row["actualMw"] for row in paired)
    forecasts = [row["forecastMw"] for row in rows if row["forecastMw"] is not None]
    return {
        "pairedHours": n, "expectedHours": len(rows), "forecastHours": len(forecasts),
        "actualHours": sum(row["actualMw"] is not None for row in rows),
        "maeMw": sum(abs(e) for e in errors) / n if n else None,
        "rmseMw": math.sqrt(sum(e * e for e in errors) / n) if n else None,
        "biasMw": sum(errors) / n if n else None,
        "wapePct": 100 * sum(abs(e) for e in errors) / actual_sum if n and actual_sum else None,
        "p90ShortfallMw": max(0, quantile(errors, 0.9)) if n else None,
        "overForecastHours": sum(e > 0 for e in errors),
        "meanForecastMw": sum(forecasts) / len(forecasts) if forecasts else None,
        "forecastEnergyMwh": sum(forecasts) if forecasts else None,
        "actualEnergyMwh": sum(row["actualMw"] for row in paired) if n else None,
    }


@lru_cache(maxsize=24)
def cohort(clock):
    return [(date(2026, 1, i), dataset().day(date(2026, 1, i), clock)) for i in range(1, 32)]


def day_analysis(decision, clock):
    data = dataset()
    cutoff = datetime.combine(decision, time.fromisoformat(clock), UTC)
    rows = data.day(decision, clock)
    # Only past January decisions and actuals published by this decision can inform the range.
    history = [row for day, day_rows in cohort(clock) if day < decision for row in day_rows
               if row["errorMw"] is not None
               and timestamp(row["startTime"]) + timedelta(hours=1) <= cutoff
               and timestamp(row["actualPublishTime"]) <= cutoff]
    historic_metrics = metrics(history)
    enough_history = len(history) >= 48
    p10 = quantile([row["errorMw"] for row in history], 0.1) if enough_history else None
    p90 = quantile([row["errorMw"] for row in history], 0.9) if enough_history else None
    for row in rows:
        forecast = row["forecastMw"]
        row["lowerMw"] = max(0, forecast - p90) if forecast is not None and enough_history else None
        row["upperMw"] = max(0, forecast - p10) if forecast is not None and enough_history else None
    pubs = sorted({row["publishTime"] for row in rows if row["publishTime"]})
    return {"decisionDate": str(decision), "deliveryDate": str(decision + timedelta(days=1)),
            "cutoff": iso(cutoff), "rows": rows, "metrics": metrics(rows),
            "history": {"metrics": historic_metrics, "rangeAvailable": enough_history,
                        "firstTarget": history[0]["startTime"] if history else None,
                        "lastTarget": history[-1]["startTime"] if history else None,
                        "p10ErrorMw": p10, "p90ErrorMw": p90},
            "publicationTimes": pubs, "retrievedAt": data.retrieved_at}


@lru_cache(maxsize=24)
def month_analysis(clock):
    days = [{"decisionDate": str(day), "deliveryDate": str(day + timedelta(days=1)),
             "day": f"{day.day:02d}", **metrics(rows)} for day, rows in cohort(clock)]
    all_rows = [row for _, rows in cohort(clock) for row in rows]
    by_hour = [{"hour": f"{hour:02d}:00", **metrics([row for row in all_rows if row["hour"] == f"{hour:02d}:00"])} for hour in range(24)]
    paired = [row for row in all_rows if row["errorMw"] is not None]
    worst = max(paired, key=lambda row: abs(row["errorMw"])) if paired else None
    return {"cutoffTime": clock, "decisionFrom": "2026-01-01", "decisionTo": "2026-01-31",
            "deliveryFrom": "2026-01-02", "deliveryTo": "2026-02-01", "days": days,
            "metrics": metrics(all_rows), "byHour": by_hour, "worstHour": worst,
            "retrievedAt": dataset().retrieved_at}
