# Verification record

Run date: 25 October 2026.

## Confirmed locally

- Retrieved and validated 19,272 forecast and 1,488 actual records from the specified Elexon stream endpoints. Manifest records all requests and a SHA-256; the integrity test passes.
- 17 Python tests pass. Five cutoff times are checked across all January decisions for future forecast exclusion.
- At 09:00 GMT, all 31 decisions have 24 paired delivery hours (744 total). 31 January correctly delivers on 1 February.
- TypeScript and Vite production build pass.
- Python API and Vite frontend start and return successful responses.
- Browser checks: default forecast and hidden actuals; reveal actuals and associated metrics; hourly table; monthly metrics and daily table; replay 31 January; midnight partial coverage (22/24 hours); replay 1 January with no prior range.

Further browser, deployment and Docker results are appended as they finish.

## Host limitation

Docker Desktop is installed, but failed on startup before its engine became available. Its backend log reports failure to remove the local `dockerInference` socket. No factory reset, deletion of Docker state, or global Docker configuration change was attempted. Container validation is run independently in GitHub Actions rather than claiming this host engine worked.

## Outside this build

No video, YouTube publication, application-form submission, live procurement integration, penetration/load audit, or calibrated forecast model. Browser smoke tests are functional checks, not a formal accessibility certification.
