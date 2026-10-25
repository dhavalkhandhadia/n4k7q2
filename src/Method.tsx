import { useRef, type ReactNode } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useScene } from "./interaction";
import type { Day } from "./types";

const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

export default function Method({
  data,
  children,
}: {
  data: Day | null;
  children: ReactNode;
}) {
  const scene = useRef<HTMLDivElement>(null);
  useScene(scene, "method");
  const published = data?.publicationTimes.at(-1);
  const row = data?.rows.find(
    (hour) => hour.forecastMw != null && hour.actualMw != null,
  );
  const maximum = Math.max(row?.forecastMw ?? 1, row?.actualMw ?? 1, 1);
  const forecast = ((row?.forecastMw ?? 0) / maximum) * 280;
  const actual = ((row?.actualMw ?? 0) / maximum) * 280;
  return (
    <div className="method-view view-content" ref={scene}>
      <section className="publication-study" data-enter>
        <div className="method-statement">
          <span className="eyebrow">01 / SELECT</span>
          <h2>
            Before the cutoff.
            <br />
            Nothing after.
          </h2>
          <p>Latest eligible publication, for each delivery hour.</p>
        </div>
        <svg
          className="cutoff-diagram"
          viewBox="0 0 680 230"
          role="img"
          aria-label="Use the latest forecast published by the decision cutoff. Later publications are excluded."
        >
          <path className="diagram-rule" d="M40 130H640" />
          <path className="diagram-ink" data-draw d="M40 130H340" />
          <path className="cutoff-rule" d="M340 45V175" />
          <circle cx="140" cy="130" r="7" className="diagram-dot" />
          <circle cx="540" cy="130" r="6" className="later-dot" />
          <text x="140" y="75" textAnchor="middle" className="diagram-value">
            {published ? time(published) : "Eligible"}
          </text>
          <text x="140" y="99" textAnchor="middle">
            Published
          </text>
          <text x="340" y="28" textAnchor="middle" className="diagram-value">
            {data ? time(data.cutoff) : "Cutoff"}
          </text>
          <text x="340" y="205" textAnchor="middle">
            Decision · GMT
          </text>
          <text x="540" y="75" textAnchor="middle" className="later-label">
            Later
          </text>
          <text x="140" y="175" textAnchor="middle" className="selected-label">
            {published ? "✓ Selected" : "No publication"}
          </text>
          <text x="540" y="175" textAnchor="middle" className="later-label">
            × Excluded
          </text>
        </svg>
      </section>
      <div className="method-pair">
        <section className="alignment-study" data-enter>
          <span className="eyebrow">02 / ALIGN</span>
          <h2>Two halves. One hour.</h2>
          <svg
            viewBox="0 0 480 160"
            role="img"
            aria-label="Average two complete half-hourly actuals to obtain one hourly actual. Do not interpolate or fill gaps."
          >
            <rect
              className="half-hour"
              x="0"
              y="36"
              width="130"
              height="45"
              rx="1"
            />
            <rect
              className="half-hour second-half"
              x="134"
              y="36"
              width="130"
              height="45"
              rx="1"
            />
            <path
              className="diagram-ink"
              data-draw
              d="M284 59H328m-9-7 9 7-9 7"
            />
            <text x="65" y="65" textAnchor="middle" className="half-label">
              30 min
            </text>
            <text x="199" y="65" textAnchor="middle" className="half-label">
              30 min
            </text>
            <text x="391" y="69" textAnchor="middle" className="diagram-result">
              1h
            </text>
            <text x="132" y="120" textAnchor="middle">
              FUELHH · WIND
            </text>
            <text x="391" y="120" textAnchor="middle">
              Mean MW
            </text>
          </svg>
          <p>Both halves required. Gaps stay gaps.</p>
        </section>
        <section className="error-study" data-enter>
          <span className="eyebrow">03 / COMPARE</span>
          <h2>The space between.</h2>
          {row ? (
            <svg
              viewBox="0 0 480 160"
              role="img"
              aria-label={`Retrospective example at ${row.hour} on ${data!.deliveryDate}: forecast ${row.forecastMw} MW minus actual ${row.actualMw} MW equals ${row.errorMw} MW error.`}
            >
              <text x="0" y="48">
                Forecast
              </text>
              <text x="0" y="91">
                Actual
              </text>
              <path
                className="forecast-sample"
                data-draw
                d={`M85 43H${85 + forecast}`}
              />
              <path
                className="actual-sample"
                data-draw
                d={`M85 86H${85 + actual}`}
              />
              <path
                className="error-bracket"
                d={`M${85 + Math.min(forecast, actual)} 112v12H${85 + Math.max(forecast, actual)}v-12`}
              />
              <text x="480" y="130" textAnchor="end" className="selected-label">
                {row.errorMw! > 0 ? "+" : ""}
                {(row.errorMw! / 1000).toFixed(2)} GW
              </text>
            </svg>
          ) : (
            <div className="diagram-unavailable">
              No paired observation at this cutoff.
            </div>
          )}
          <p>
            Forecast − actual = error <span>· hindsight example</span>
          </p>
        </section>
      </div>
      <div className="method-boundary" data-enter>
        <span>National wind only</span>
        <ArrowRight size={16} />
        <span>Portfolio demand needed for purchase volumes</span>
      </div>
      <details className="method-notes hourly-details">
        <summary>
          <span>
            Assumptions & formulas{" "}
            <small>Range, metrics, source boundaries</small>
          </span>
          <span className="summary-plus">+</span>
        </summary>
        {children}
      </details>
      <div className="method-sources">
        <span>Elexon · WINDFOR + FUELHH</span>
        <a href="/api/docs" target="_blank" rel="noreferrer">
          Python API <ExternalLink size={13} />
        </a>
        <span>
          {data
            ? `Snapshot ${new Date(data.retrievedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
            : "Historical snapshot"}
        </span>
      </div>
    </div>
  );
}
