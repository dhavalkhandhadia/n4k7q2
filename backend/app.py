import csv
import io
import logging
import re
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.analysis import cohort, dataset, day_analysis, month_analysis

app = FastAPI(title="Northline Wind API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
logger = logging.getLogger(__name__)


def validate(decision_date, cutoff):
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", cutoff):
        raise HTTPException(422, "Cutoff must be a valid HH:MM time in GMT.")
    if not date(2026, 1, 1) <= decision_date <= date(2026, 1, 31):
        raise HTTPException(422, "Decision date must be in January 2026.")


@app.exception_handler(OSError)
async def unavailable_data(_request, exc):
    logger.error("Data snapshot could not be read: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Data snapshot unavailable. Run scripts/fetch_data.py and restart the server."})


@app.get("/api/health")
def health():
    return {"status": "ok", "retrievedAt": dataset().retrieved_at, **dataset().counts}


@app.get("/api/day")
def day(decision_date: date = date(2026, 1, 14), cutoff: str = Query("09:00", max_length=5)):
    validate(decision_date, cutoff)
    return day_analysis(decision_date, cutoff)


@app.get("/api/month")
def month(cutoff: str = Query("09:00", max_length=5)):
    validate(date(2026, 1, 1), cutoff)
    return month_analysis(cutoff)


@app.get("/api/export")
def export(scope: Literal["day", "month"] = "day", decision_date: date = date(2026, 1, 14),
           cutoff: str = Query("09:00", max_length=5)):
    validate(decision_date, cutoff)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["decision_date", "decision_cutoff_gmt", "delivery_start_utc", "forecast_publish_utc", "forecast_mw", "actual_mw", "forecast_minus_actual_mw", "lead_hours"])
    days = cohort(cutoff) if scope == "month" else [(decision_date, dataset().day(decision_date, cutoff))]
    for day_date, rows in days:
        for row in rows:
            writer.writerow([day_date, cutoff, row["startTime"], row["publishTime"], row["forecastMw"], row["actualMw"], row["errorMw"], row["leadHours"]])
    return Response(output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="northline-{scope}-{decision_date if scope == "day" else "jan2026"}-{cutoff.replace(":", "")}.csv"',
        "X-Content-Type-Options": "nosniff"})


# Docker serves the built React app from the same origin. Vercel serves dist via its CDN.
DIST = Path(__file__).resolve().parents[1] / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(DIST / "index.html")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(DIST / "favicon.svg")
