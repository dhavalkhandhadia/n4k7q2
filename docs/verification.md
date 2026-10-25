# Verification record

Run date: 25 October 2026.

## Confirmed locally

- Retrieved and validated 19,272 forecast and 1,488 actual records from the specified Elexon stream endpoints. Manifest records all requests and a SHA-256; the integrity test passes.
- 17 Python tests pass. Five cutoff times are checked across all January decisions for future forecast exclusion.
- At 09:00 GMT, all 31 decisions have 24 paired delivery hours (744 total). 31 January correctly delivers on 1 February.
- TypeScript and Vite production build pass.
- Python API and Vite frontend start and return successful responses.
- Browser checks: default forecast and hidden actuals; reveal actuals and associated metrics; hourly table; monthly metrics and daily table; replay 31 January; midnight partial coverage (22/24 hours); replay 1 January with no prior range.

## Deployment and independent container verification

- Live canonical URL: https://n4k7q2.vercel.app. Browser verified the populated desk and the real Python API response path, rather than only a static frontend shell. The browser console contained no warning/error entries in the inspected log.
- Public anonymous-name repository: https://github.com/dhavalkhandhadia/n4k7q2.
- [GitHub Actions run 40172363258](https://github.com/dhavalkhandhadia/n4k7q2/actions/runs/40172363258) passed on Ubuntu: all 17 tests on Python 3.12, the production React build on Node 22, Docker image build, and running-container checks of frontend, health, and 744 paired monthly hours.
- The approved A2 landing was inspected at 320, 375 and 768 CSS-pixel widths; document width did not exceed the viewport after correcting the mobile headline size. The desk was visually inspected at 375 pixels with no page overflow. Real-device verification remains outside these browser checks.
- The shared source document was view-only. No source document edits, YouTube upload, or form submission were performed.

## Design checkpoint

The user approved A2 after the second research and mockup round. The implementation preserves its two-line serif headline, minimal copy, single desk action, and uninterrupted generated panorama. The desk shares its paper, ink and typography theme.

The redesign browser smoke confirmed landing-to-desk navigation, the methodology direct link, date stepping, native date/time keyboard entry and Apply, opt-in actuals, the expanded hourly table with half-MW precision, monthly metrics, and replay of 31 January into 1 February. The inspected warning/error console was empty. The automation fill helper did not emit React-compatible change events for native date/time controls; keyboard entry was used to verify those controls. Browser emulation of reduced motion could not be completed because the browser debugger disconnected; reduced-motion handling is present in MotionConfig and component guards, but is not claimed as browser-tested.

## Host limitation

Docker Desktop is installed, but failed on startup before its engine became available. Its backend log reports failure to remove the local `dockerInference` socket. No factory reset, deletion of Docker state, or global Docker configuration change was attempted. Container validation is run independently in GitHub Actions rather than claiming this host engine worked.

## Outside this build

No video, YouTube publication, application-form submission, live procurement integration, penetration/load audit, or calibrated forecast model. Browser smoke tests are functional checks, not a formal accessibility certification.
