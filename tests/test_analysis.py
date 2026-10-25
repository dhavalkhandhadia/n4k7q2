import csv
import gzip
import hashlib
import io
import json
import math
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.analysis import WindData, cohort, dataset, day_analysis, metrics, month_analysis, quantile, timestamp
from backend.app import app


def row(start, publish, generation):
    return {"startTime": start, "publishTime": publish, "generation": generation}


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.data = WindData({"retrievedAt": "2026-10-25T00:00:00Z", "forecasts": [
            row("2026-01-03T00:00:00Z", "2026-01-02T07:30:00Z", 100),
            row("2026-01-03T00:00:00Z", "2026-01-02T09:00:00Z", 120),
            row("2026-01-03T00:00:00Z", "2026-01-02T09:30:00Z", 999),
        ], "actuals": [
            row("2026-01-03T00:00:00Z", "2026-01-03T00:30:00Z", 80),
            row("2026-01-03T00:30:00Z", "2026-01-03T01:00:00Z", 100),
        ]})

    def test_cutoff_inclusive_and_future_publication_excluded(self):
        result = self.data.day(date(2026, 1, 2), "09:00")[0]
        self.assertEqual(result["forecastMw"], 120)
        self.assertEqual(result["publishTime"], "2026-01-02T09:00:00Z")
        self.assertEqual(result["actualMw"], 90)
        self.assertEqual(result["errorMw"], 30)
        self.assertEqual(result["leadHours"], 15)

    def test_missing_forecast_is_not_zero(self):
        result = self.data.day(date(2026, 1, 2), "07:00")[0]
        self.assertIsNone(result["forecastMw"])
        self.assertIsNone(result["errorMw"])

    def test_incomplete_actual_hour_is_missing(self):
        del self.data.actuals[timestamp("2026-01-03T00:30:00Z")]
        result = self.data.day(date(2026, 1, 2), "09:00")[0]
        self.assertIsNone(result["actualMw"])
        self.assertIsNone(result["errorMw"])

    def test_latest_actual_revision(self):
        self.data.actuals[timestamp("2026-01-03T00:00:00Z")].append((timestamp("2026-01-04T00:00:00Z"), 120))
        self.assertEqual(self.data.day(date(2026, 1, 2), "09:00")[0]["actualMw"], 110)

    def test_conflicting_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            WindData.index([row("2026-01-01T00:00:00Z", "2025-12-31T09:00:00Z", n) for n in (1, 2)])

    def test_non_finite_generation_rejected(self):
        with self.assertRaises(ValueError):
            WindData.index([row("2026-01-01T00:00:00Z", "2025-12-31T09:00:00Z", math.nan)])


class MetricsTests(unittest.TestCase):
    def test_hand_calculated_errors_and_zero_actual(self):
        result = metrics([{"forecastMw": f, "actualMw": a, "errorMw": f - a} for f, a in ((120, 100), (60, 100), (0, 0))])
        self.assertEqual(result["pairedHours"], 3)
        self.assertEqual(result["maeMw"], 20)
        self.assertAlmostEqual(result["rmseMw"], math.sqrt(2000 / 3))
        self.assertAlmostEqual(result["biasMw"], -20 / 3)
        self.assertEqual(result["wapePct"], 30)
        self.assertEqual(result["forecastEnergyMwh"], 180)

    def test_empty_and_zero_denominator(self):
        self.assertIsNone(metrics([])["maeMw"])
        self.assertIsNone(metrics([{"forecastMw": 1, "actualMw": 0, "errorMw": 1}])["wapePct"])

    def test_quantile(self):
        self.assertEqual(quantile([0, 10], .9), 9)
        self.assertIsNone(quantile([], .9))


class SnapshotTests(unittest.TestCase):
    def test_all_decisions_have_complete_hourly_pairs(self):
        result = month_analysis("09:00")
        self.assertEqual(result["metrics"]["pairedHours"], 744)
        self.assertTrue(all(day["pairedHours"] == 24 for day in result["days"]))
        self.assertEqual(result["days"][-1]["deliveryDate"], "2026-02-01")

    def test_forecast_invariant_at_several_cutoffs(self):
        for cutoff in ("00:00", "09:00", "09:30", "15:00", "23:59"):
            for decision, rows in cohort(cutoff):
                bound = datetime.fromisoformat(f"{decision}T{cutoff}:00+00:00")
                for hour in rows:
                    if hour["publishTime"] is not None:
                        self.assertLessEqual(timestamp(hour["publishTime"]), bound)
                    else:
                        self.assertIsNone(hour["forecastMw"])

    def test_risk_view_uses_only_available_past_actuals(self):
        decision = date(2026, 1, 14)
        bound = timestamp("2026-01-14T09:00:00Z")
        eligible = [r for day, rows in cohort("09:00") if day < decision for r in rows
                    if r["errorMw"] is not None and timestamp(r["actualPublishTime"]) <= bound
                    and timestamp(r["startTime"]) + timedelta(hours=1) <= bound]
        result = day_analysis(decision, "09:00")
        self.assertEqual(result["history"]["metrics"]["pairedHours"], len(eligible))
        self.assertAlmostEqual(result["history"]["p90ErrorMw"], quantile([r["errorMw"] for r in eligible], .9))
        self.assertTrue(all(r["lowerMw"] <= r["upperMw"] for r in result["rows"]))

    def test_early_month_has_no_invented_risk_range(self):
        result = day_analysis(date(2026, 1, 1), "09:00")
        self.assertFalse(result["history"]["rangeAvailable"])
        self.assertTrue(all(r["lowerMw"] is None for r in result["rows"]))

    def test_snapshot_matches_manifest_and_raw_independent_calculation(self):
        root = Path(__file__).resolve().parents[1]
        blob = (root / "data/elexon-jan2026.json.gz").read_bytes()
        manifest = json.loads((root / "data/manifest.json").read_text())
        self.assertEqual(hashlib.sha256(blob).hexdigest(), manifest["sha256"])
        raw = json.loads(gzip.decompress(blob))
        cutoff = "2026-01-14T09:00:00Z"
        # Independently filter the raw input rather than reusing the selector under test.
        selected = [r for r in raw["forecasts"] if r["startTime"] == "2026-01-15T12:00:00Z" and r["publishTime"] <= cutoff]
        forecast = max(selected, key=lambda r: r["publishTime"])["generation"]
        halves = [r["generation"] for r in raw["actuals"] if r["startTime"] in ("2026-01-15T12:00:00Z", "2026-01-15T12:30:00Z")]
        self.assertEqual(len(halves), 2)
        result = day_analysis(date(2026, 1, 14), "09:00")["rows"][12]
        self.assertEqual(result["forecastMw"], forecast)
        self.assertEqual(result["actualMw"], sum(halves) / 2)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_endpoints_and_validation(self):
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")
        self.assertEqual(len(self.client.get("/api/day").json()["rows"]), 24)
        self.assertEqual(self.client.get("/api/month").json()["metrics"]["pairedHours"], 744)
        for query in ("decision_date=2025-12-31", "decision_date=2026-02-01", "decision_date=banana", "cutoff=25:00", "cutoff=9:00", "cutoff=09:99"):
            self.assertEqual(self.client.get(f"/api/day?{query}").status_code, 422, query)

    def test_csv_matches_analysis_and_escapes_parameters(self):
        response = self.client.get("/api/export?scope=month&cutoff=09:00")
        self.assertEqual(response.status_code, 200)
        rows = list(csv.DictReader(io.StringIO(response.text)))
        self.assertEqual(len(rows), 744)
        expected = day_analysis(date(2026, 1, 1), "09:00")["rows"][0]
        self.assertEqual(float(rows[0]["forecast_mw"]), expected["forecastMw"])
        self.assertEqual(rows[-1]["delivery_start_utc"], "2026-02-01T23:00:00Z")
        self.assertEqual(self.client.get("/api/export?scope=other").status_code, 422)

    def test_missing_data_is_actionable(self):
        with patch("backend.app.dataset", side_effect=FileNotFoundError("missing")):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertIn("snapshot unavailable", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
