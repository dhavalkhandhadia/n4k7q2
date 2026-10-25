"""Fetch the two assignment datasets; no API key or other data sources."""
import gzip
import hashlib
import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


def fetch(job):
    dataset, day = job
    if dataset == "WINDFOR":
        params = {"publishDateTimeFrom": f"{day}T00:00:00Z", "publishDateTimeTo": f"{day + timedelta(days=1)}T00:00:00Z"}
    else:
        params = {"settlementDateFrom": str(day), "settlementDateTo": str(day), "fuelType": "WIND"}
    url = f"{BASE}/{dataset}/stream?{urlencode(params)}"
    for attempt in range(5):
        try:
            with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=60) as response:
                rows = json.load(response)
            if not isinstance(rows, list) or not rows:
                raise ValueError(f"Empty or malformed response: {url}")
            for row in rows:
                datetime.fromisoformat(row["startTime"].replace("Z", "+00:00"))
                datetime.fromisoformat(row["publishTime"].replace("Z", "+00:00"))
                if not isinstance(row["generation"], (float, int)) or not math.isfinite(row["generation"]) or row["generation"] < 0:
                    raise ValueError(f"Invalid generation from {url}")
                if row.get("dataset") != dataset or (dataset == "FUELHH" and row.get("fuelType") != "WIND"):
                    raise ValueError(f"Wrong dataset/fuel from {url}")
            print(f"{dataset} {day}: {len(rows)} rows", flush=True)
            return dataset, rows, url
        except (HTTPError, URLError, TimeoutError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def main():
    # Two days of earlier forecast publications allow a carry-forward at early January cutoffs.
    jobs = [("WINDFOR", date(2025, 12, 30) + timedelta(days=i)) for i in range(33)]
    jobs += [("FUELHH", date(2026, 1, 2) + timedelta(days=i)) for i in range(31)]
    collected = {"WINDFOR": {}, "FUELHH": {}}
    requests = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for dataset, rows, url in pool.map(fetch, jobs):
            requests.append({"url": url, "rows": len(rows)})
            for row in rows:
                key = row["startTime"], row["publishTime"]
                existing = collected[dataset].get(key)
                if existing and existing != row:
                    raise ValueError(f"Conflicting duplicate: {dataset} {key}")
                collected[dataset][key] = row
    payload = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "decisionFrom": "2026-01-01", "decisionTo": "2026-01-31",
        "forecasts": sorted(collected["WINDFOR"].values(), key=lambda r: (r["startTime"], r["publishTime"])),
        "actuals": sorted(collected["FUELHH"].values(), key=lambda r: (r["startTime"], r["publishTime"])),
    }
    encoded = json.dumps(payload, separators=(",", ":")).encode()
    target = ROOT / "data" / "elexon-jan2026.json.gz"
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(gzip.compress(encoded, mtime=0))
    # Never replace the working snapshot until the entire download validates.
    temporary.replace(target)
    manifest = {"retrievedAt": payload["retrievedAt"], "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "forecastRows": len(payload["forecasts"]), "actualRows": len(payload["actuals"]), "requests": requests}
    (ROOT / "data" / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Saved {target}: {len(payload['forecasts'])} forecasts / {len(payload['actuals'])} actuals", flush=True)


if __name__ == "__main__":
    main()
