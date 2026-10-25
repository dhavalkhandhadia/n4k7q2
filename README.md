# Northline · Wind intelligence

A January 2026 pilot for a UK utility's day-ahead desk. Replay the wind forecast **available at a buying decision**, then evaluate it against the specified Elexon actuals. React + TypeScript frontend, Python/FastAPI backend, Docker, Vercel.

## Use the application

1. Select a **decision date** (1–31 January 2026) and forecast cutoff, then Apply. Delivery is the following day.
2. See the latest eligible forecast per delivery hour, its publication time, daily energy, and past forecast error.
3. Reveal actuals to review that delivery day with hindsight. This is off by default.
4. Open **Forecast accuracy** for the January decision cohort and replay any daily result.
5. Export the selected day or full month as CSV. **Data & methodology** explains every assumption.

The default is 14 January, 09:00 GMT, delivering 15 January. Date/cutoff/view are shareable in the URL.

## Run with Docker

```sh
docker compose up --build
```

Open http://localhost:8000. The multi-stage image builds React, serves it with FastAPI, runs as an unprivileged user, and has an API health check. No keys or runtime Elexon connection are needed. Stop with `docker compose down`.

## Run locally

Python 3.12+ and Node.js 22+ are required.

```sh
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
npm ci
```

Start two terminals in the project directory:

```sh
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Python on port 8000. Stop both processes with Ctrl+C.

## Verify

```sh
python -m unittest discover -s tests -v
npm run build
```

17 tests cover cutoff selection, future-publication exclusion, hourly alignment, missing observations, duplicate conflicts, non-finite values, hand-calculated metrics, zero denominators, early-month risk suppression, publication invariants at five cutoffs, source checksum, raw-record cross-check, API validation, failure handling, and CSV parity. GitHub Actions also builds and starts the Docker image and checks frontend/API responses.

## Data and methodology

Only the two datasets in the brief supply data:

- [WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream): queried by publication time, not by target date. The snapshot retains 19,272 records including 30–31 December carry-forward publications needed at early January cutoffs.
- [FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream): filtered to `fuelType=WIND`, 1,488 half-hourly actuals for 2 January–1 February 2026.

Every January decision buys for D+1. Consequently the evaluation delivery window is **2 January–1 February**, not 1–31 January. No decisions in December are evaluated. The manifest records retrieval time, all 64 request URLs, record counts, and the compressed source SHA-256.

For each target hour, take the largest `publishTime` at or before the decision cutoff. Do not take the latest forecast at retrieval time. The sample has hourly WINDFOR records and half-hourly FUELHH records, so hourly actuals require both half-hours and use their mean. No interpolation, zero-filling, or repeated forecasts. The hourly forecast value is treated as the reported hour's average for this pilot; this alignment convention is an assumption and should be confirmed with the client before operational use.

`error = forecast − actual` in MW. Positive error means wind was over-forecast. MAE = mean absolute error; RMSE = square root of mean squared error; bias = mean signed error; WAPE = sum absolute error / sum paired actuals × 100. Missing pairs are excluded, and WAPE is null when the denominator is zero. MW is power. Each hourly MW value contributes the same numerical MWh; divide daily MWh by 1,000 for GWh. On the desk the sum includes available forecast hours; incomplete coverage is explicitly flagged.

The **past-error range** uses earlier January decisions at the same cutoff. Only completed hours whose actual records were published by the selected decision qualify. At least 48 paired hours are required. For signed error percentiles q10/q90, the displayed generation range is `[max(0, forecast−q90), max(0, forecast−q10)]`. Percentiles use linear interpolation (type 7). Prior P90 shortfall = `max(0, q90(error))`.

This range is **descriptive, not a calibrated prediction interval**. It has no out-of-sample coverage guarantee, and hourly errors are correlated. Early January may have no range. Full-month performance is retrospective and never feeds an earlier risk view.

The 09:00 GMT default is an adjustable analyst cutoff, not a hard-coded claim about a specific exchange's gate closure. [EPEX's trading brochure](https://www.epexspot.com/sites/default/files/2024-12/_Trading%20brochure%202024%20December%20%281%29.pdf) and [Nord Pool's N2EX description](https://support.nordpoolgroup.com/support/solutions/articles/8000088463-about-the-n2ex-day-ahead-auction) illustrate why a cutoff must be explicit. No price or demand data are imported.

### Pilot findings at 09:00 GMT

Across all 744 paired hours, MAE is **2.039 GW**, RMSE **2.505 GW**, bias **+1.748 GW**, and WAPE **18.07%**. There are 632 over-forecast hours. The smallest daily MAE is the 18 January decision (0.736 GW); the largest is 27 January (5.375 GW). These are observations of the specified dataset comparison, not evidence of its cause. They do not estimate trading costs or prescribe purchases.

### Limits

- National wind only; portfolio demand, contracted generation, prices, curtailment and assets are outside the brief. A residual purchase volume cannot be calculated from these two inputs alone.
- This is Elexon's wind series, not an asserted complete inventory of every UK wind installation. Its [wind documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/forecast/generation/wind/latest) refers to farms visible to the system operator with operational metering. Scope/curtailment differences can contribute to observed errors; no causal attribution is made.
- Actuals are the latest returned values in the retrieved snapshot. This is not a reconstruction of every historical actual revision. The prior-risk filter is conservative: actual publication timestamps must be at or before cutoff.
- The historical snapshot is intentionally bundled for a reproducible, fast demo. It is not a live trading feed. To refresh it, run `python scripts/fetch_data.py`, rerun tests, and restart/redeploy. A failed download leaves the old snapshot intact. Successful refresh replaces the fixed snapshot and manifest, so commit them together.
- No authentication, orders, user accounts, persistent user storage, or production trading integration. The API exposes public historical data only.
- Web fonts come from Google Fonts; system sans-serif is the fallback. The JS chart bundle is approximately 200 KB gzip.

## Architecture and files

```text
src/App.tsx                  React views, controls, charts, accessible tables
src/types.ts                 API response types
src/style.css                Responsive Northline visual design
src/main.tsx                 React entry point
backend/analysis.py          Indexed data, as-of selection, metrics, risk, cohort
backend/app.py               FastAPI endpoints, validation, CSV, Docker static serving
api/index.py                 Vercel ASGI entry point
scripts/fetch_data.py        Validated, bounded-concurrency ingestion with retries
data/elexon-jan2026.json.gz   Original Elexon records, compressed
data/manifest.json           Request provenance, counts, retrieval timestamp, SHA-256
tests/test_analysis.py       17 unit/integration/data tests
.github/workflows/verify.yml Build, tests, Docker build and running-container smoke test
Dockerfile / compose.yaml   One-command containerized app
vercel.json                 Static React output + Python function routing
docs/architecture.md         Technical decisions and review guide
docs/verification.md         Observed validation and remaining limitations
```

The frontend requests `/api/day` and `/api/month`. Python owns every calculation. Immutable records are indexed once per process; bounded in-memory caches reuse cutoff cohorts. No database is necessary for a fixed month. Request cancellation and matching URL keys prevent stale UI results after changes. Chart/table exports use the same selector.

API docs: `/api/docs`. Health: `/api/health`. CSV: `/api/export?scope=day|month&decision_date=2026-01-14&cutoff=09:00`.

## Deploy to Vercel

```sh
vercel deploy -y
```

Vercel builds the Vite frontend and runs `api/index.py` as a Python function with the same snapshot. Docker is the portable local/runtime deliverable; Vercel uses its own Python runtime. Production publication can be done with `vercel deploy --prod` when wanted.

Live application: **https://n4k7q2.vercel.app**

Public repository: **https://github.com/dhavalkhandhadia/n4k7q2** (anonymous name as requested in the brief).

## AI assistance

**OpenAI Codex was used** to read the supplied brief, research the official API documentation, implement the frontend/backend, author tests and documentation, and help verify and deploy the application. All displayed generation values come from Elexon; no synthetic values or AI-generated forecasts are used. The person presenting the project should review and understand the implementation and assumptions.

## Remaining submission work

Video preparation is deliberately deferred at the user's request. The brief requires an unlisted YouTube video of at most 10 minutes: up to 5 minutes for the customer-facing overview, and up to 5 minutes for the technical review. Do not submit the form before that video exists. Then check every submitted URL in incognito mode and complete the supplied form. No video has been created or form submitted by this project build.
