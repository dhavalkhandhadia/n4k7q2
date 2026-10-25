import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  Wind,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Day, Month } from "./types";
import { KeyboardInput, RollingValue, Toggle, useScene } from "./interaction";
import Method from "./Method";
import gsap from "gsap";

type View = "desk" | "accuracy" | "method";
const number = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(n);
const gw = (n: number | null | undefined) =>
  n == null ? "—" : number(n / 1000, 2);
const displayDate = (d: string, long = false) =>
  new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
const utcTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

function useData<T>(url: string) {
  const previous = useRef<T | null>(null);
  const [result, setResult] = useState<{
    url: string;
    data: T | null;
    error: string | null;
  }>({ url: "", data: null, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ url, data: null, error: null });
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(
            typeof error?.detail === "string"
              ? error.detail
              : `Unable to load data (${response.status}).`,
          );
        }
        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        previous.current = data;
        setResult({ url, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError")
          setResult({ url, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [url, retry]);
  return {
    data: result.url === url ? result.data : null,
    previous: previous.current,
    error: result.url === url ? result.error : null,
    retry: () => setRetry((n) => n + 1),
  };
}

function Metric({
  label,
  value,
  unit,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`} data-enter>
      <p>{label}</p>
      <div className="metric-value">
        <RollingValue value={value} />
        <span>{unit}</span>
      </div>
      <small>{detail}</small>
    </div>
  );
}

function Empty({ error, retry }: { error: string | null; retry: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="load-state" role={error ? "alert" : "status"}>
      {error ? (
        <>
          <Info size={22} />
          <h2>We couldn’t load this view</h2>
          <p>{error}</p>
          <button className="button" onClick={retry}>
            <RefreshCw size={15} />
            Try again
          </button>
        </>
      ) : (
        <>
          <motion.span
            animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <Wind size={28} />
          </motion.span>
          <p>Aligning forecasts and actuals…</p>
        </>
      )}
    </div>
  );
}

function DataView<T>({
  result,
  children,
}: {
  result: {
    data: T | null;
    previous: T | null;
    error: string | null;
    retry: () => void;
  };
  children: (data: T) => ReactNode;
}) {
  const shown = result.data ?? result.previous;
  return (
    <div className="data-scene" aria-busy={!result.data && !result.error}>
      {shown && (
        <div
          className="data-surface"
          style={{ visibility: result.data ? "visible" : "hidden" }}
          aria-hidden={!result.data}
          inert={!result.data}
        >
          {children(shown)}
        </div>
      )}
      {!result.data && (
        <div className={shown ? "data-overlay" : undefined}>
          <Empty error={result.error} retry={result.retry} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const reduceMotion = useReducedMotion();
  const initial = new URLSearchParams(window.location.search);
  const initialDate = initial.get("date") || "";
  const initialTime = initial.get("cutoff") || "";
  const [date, setDate] = useState(
    /^2026-01-(0[1-9]|[12]\d|3[01])$/.test(initialDate)
      ? initialDate
      : "2026-01-14",
  );
  const [cutoff, setCutoff] = useState(
    /^([01]\d|2[0-3]):[0-5]\d$/.test(initialTime) ? initialTime : "09:00",
  );
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState(cutoff);
  const [view, setView] = useState<View>(
    initial.get("view") === "accuracy"
      ? "accuracy"
      : initial.get("view") === "method"
        ? "method"
        : "desk",
  );
  const [actuals, setActuals] = useState(false);
  const [range, setRange] = useState(true);
  const [keyboardView, setKeyboardView] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState(false);
  const day = useData<Day>(`/api/day?decision_date=${date}&cutoff=${cutoff}`);
  const month = useData<Month>(`/api/month?cutoff=${cutoff}`);
  useEffect(() => {
    const params = new URLSearchParams({ date, cutoff, view });
    window.history.replaceState(null, "", `?${params}`);
    document.title = `Northline — ${view === "method" ? "Methodology" : view === "accuracy" ? "Forecast accuracy" : "Day-ahead desk"}`;
  }, [date, cutoff, view]);
  const moveDate = (offset: number) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + offset);
    const value = next.toISOString().slice(0, 10);
    setDate(value);
    setDraftDate(value);
  };
  const selectDay = (value: string) => {
    setDate(value);
    setDraftDate(value);
    setView("desk");
  };
  const scope = view === "accuracy" ? "month" : "day";
  return (
    <>
      <a className="skip-link" href="#desk-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Northline home">
          NORTHLINE
        </a>
        <div className="header-right">
          <span className="dataset-status">
            <span className="status-dot" />
            Elexon · archived data
          </span>
          <a className="home-link" href="/">
            Home <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <KeyboardInput.Provider value={keyboardInput}>
        <main
          id="desk-content"
          className="desk-main"
          onKeyDownCapture={(event) => {
            event.currentTarget.dataset.input = "keyboard";
            setKeyboardInput(true);
          }}
          onPointerDownCapture={(event) => {
            event.currentTarget.dataset.input = "pointer";
            setKeyboardInput(false);
          }}
        >
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span className="small-line" />
                GB WIND / ARCHIVE
              </div>
              <motion.h1
                key={view}
                initial={
                  keyboardView || reduceMotion
                    ? false
                    : { transform: "translateY(8px)", opacity: 0.5 }
                }
                animate={{ transform: "translateY(0px)", opacity: 1 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                {view === "accuracy"
                  ? "Forecast accuracy"
                  : view === "method"
                    ? "Methodology"
                    : "Day-ahead desk"}
              </motion.h1>
            </div>
            <div className="period-stamp">
              <strong>January 2026</strong>
              <span>31 decisions · GMT</span>
            </div>
          </section>
          <nav className="view-tabs" aria-label="Dashboard views">
            {(
              [
                ["desk", "Day-ahead"],
                ["accuracy", "Accuracy"],
                ["method", "Methodology"],
              ] as [View, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={(event) => {
                  setKeyboardView(event.detail === 0);
                  setView(key);
                }}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
              >
                {label}
                {view === key && (
                  <motion.span
                    className="tab-indicator"
                    layoutId="desk-tab"
                    transition={{
                      duration: keyboardView || reduceMotion ? 0 : 0.18,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                  />
                )}
              </button>
            ))}
          </nav>
          {view !== "method" && (
            <div className="control-bar">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (view === "desk") setDate(draftDate);
                  setCutoff(draftTime);
                }}
              >
                {view === "desk" && (
                  <>
                    <label>
                      <span>Decision date</span>
                      <span className="input-wrap">
                        <CalendarDays size={15} />
                        <input
                          aria-label="Decision date"
                          type="date"
                          name="decision_date"
                          min="2026-01-01"
                          max="2026-01-31"
                          value={draftDate}
                          onChange={(e) => setDraftDate(e.target.value)}
                          required
                        />
                      </span>
                    </label>
                    <div className="date-stepper">
                      <button
                        type="button"
                        aria-label="Previous decision day"
                        disabled={date === "2026-01-01"}
                        onClick={() => moveDate(-1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next decision day"
                        disabled={date === "2026-01-31"}
                        onClick={() => moveDate(1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <span className="control-divider" />
                  </>
                )}
                <label>
                  <span>
                    Forecast cutoff <small>GMT</small>
                  </span>
                  <input
                    aria-label="Forecast cutoff GMT"
                    type="time"
                    name="cutoff"
                    value={draftTime}
                    onChange={(e) => setDraftTime(e.target.value)}
                    required
                  />
                </label>
                <button
                  className="apply-button"
                  type="submit"
                  disabled={
                    (view !== "desk" || draftDate === date) &&
                    draftTime === cutoff
                  }
                >
                  Apply <ArrowRight size={14} />
                </button>
              </form>
              <a
                className="export-link"
                aria-label={`Export ${scope} as CSV`}
                href={`/api/export?scope=${scope}&decision_date=${date}&cutoff=${cutoff}`}
                download
              >
                <Download size={16} />
                <span>Export {scope === "month" ? "month" : "day"}</span>
              </a>
            </div>
          )}
          {view === "desk" && (
            <DataView result={day}>
              {(value) => (
                <Desk
                  data={value}
                  actuals={actuals}
                  setActuals={setActuals}
                  range={range}
                  setRange={setRange}
                />
              )}
            </DataView>
          )}
          {view === "accuracy" && (
            <DataView result={month}>
              {(value) => (
                <Accuracy
                  data={value}
                  selectedDate={date}
                  selectDay={selectDay}
                />
              )}
            </DataView>
          )}
          {view === "method" && (
            <Method data={day.data}>
              <MethodNotes />
            </Method>
          )}
          <footer>
            <span>NORTHLINE</span>
            <span>Source: Elexon Insights · January 2026 pilot</span>
          </footer>
        </main>
      </KeyboardInput.Provider>
    </>
  );
}

function Desk({
  data,
  actuals,
  setActuals,
  range,
  setRange,
}: {
  data: Day;
  actuals: boolean;
  setActuals: (value: boolean) => void;
  range: boolean;
  setRange: (value: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const scene = useRef<HTMLDivElement>(null);
  useScene(scene, "desk");
  useLayoutEffect(() => {
    if (!actuals || reduceMotion) return;
    const context = gsap.context(() => {
      const curve = scene.current?.querySelector(".actual-generation");
      if (curve)
        gsap.from(curve, {
          opacity: 0,
          duration: 0.24,
          ease: "power2.out",
          clearProps: "opacity",
        });
    }, scene);
    return () => context.revert();
  }, [actuals, reduceMotion]);
  const m = data.metrics,
    history = data.history;
  const available = data.rows.filter((row) => row.forecastMw != null);
  const minimum = available.length
    ? available.reduce((a, b) => (a.forecastMw! < b.forecastMw! ? a : b))
    : null;
  const latest = data.publicationTimes.at(-1);
  const chartRows = data.rows.map((row) => ({
    ...row,
    range: row.lowerMw == null ? null : [row.lowerMw, row.upperMw],
  }));
  return (
    <div className="view-content desk-view" ref={scene}>
      <ol
        className="decision-timeline"
        aria-label="Forecast selection timeline"
        data-enter
      >
        <li>
          <span>Published</span>
          <strong>
            {latest
              ? `${displayDate(latest)} · ${utcTime(latest)}`
              : "Unavailable"}
          </strong>
        </li>
        <li>
          <span>Decision</span>
          <strong>
            {displayDate(data.decisionDate)} · {utcTime(data.cutoff)}
          </strong>
        </li>
        <li>
          <span>Delivery</span>
          <strong>{displayDate(data.deliveryDate)} · 24h</strong>
        </li>
      </ol>
      {m.forecastHours < 24 && (
        <div className="notice warning">
          <Info size={17} />
          Incomplete forecast: {m.forecastHours}/24 hours available. Energy
          totals below cover available hours only.
        </div>
      )}
      <section className="metrics" aria-label="Day-ahead key figures">
        <Metric
          label="WIND FORECAST"
          value={gw(m.meanForecastMw)}
          unit="GW"
          detail={`${m.forecastHours}/24 hours`}
          accent
        />
        <Metric
          label="DAY’S ENERGY"
          value={gw(m.forecastEnergyMwh)}
          unit="GWh"
          detail={
            m.forecastHours === 24
              ? "Full delivery day"
              : "Partial day · missing hours excluded"
          }
        />
        <Metric
          label="LOWEST HOUR"
          value={gw(minimum?.forecastMw)}
          unit="GW"
          detail={
            minimum
              ? `${minimum.hour}–${String(+minimum.hour.slice(0, 2) + 1).padStart(2, "0")}:00 GMT`
              : "No forecast available"
          }
        />
        <Metric
          label="PAST ERROR · MAE"
          value={gw(history.metrics.maeMw)}
          unit="GW"
          detail={`${history.metrics.pairedHours} prior hours`}
        />
      </section>
      <div className="desk-grid" data-enter>
        <section className="chart-panel">
          <div className="section-top">
            <div>
              <div className="eyebrow">THE DELIVERY DAY</div>
              <h2>Tomorrow’s wind profile</h2>
              <p>
                {displayDate(data.deliveryDate, true)} · hourly mean generation
              </p>
            </div>
            <span className="unit-label">GW</span>
          </div>
          <div className="chart-options">
            <span className="forecast-legend">
              <span className="legend-line" /> Forecast
            </span>
            <Toggle
              label="Past-error range"
              checked={range}
              disabled={!history.rangeAvailable}
              onChange={setRange}
            />
            <Toggle
              label="Actuals · hindsight"
              checked={actuals}
              onChange={setActuals}
            />
          </div>
          <div
            className="profile-chart"
            role="img"
            aria-label={`Wind generation profile for ${data.deliveryDate}. Forecast mean ${gw(m.meanForecastMw)} GW. Exact values are in the hourly table below.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartRows}
                margin={{ top: 18, right: 12, bottom: 8, left: -12 }}
              >
                <CartesianGrid stroke="#e7ebe6" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#77817a", fontSize: 11 }}
                  interval={3}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tickFormatter={(value) => number(value / 1000, 0)}
                  tick={{ fill: "#77817a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  content={
                    <WindTooltip
                      actuals={actuals}
                      showRange={range && history.rangeAvailable}
                    />
                  }
                />
                {range && history.rangeAvailable && (
                  <Area
                    name="Past-error range"
                    dataKey="range"
                    type="linear"
                    stroke="none"
                    fill="#c4d5c7"
                    fillOpacity={0.48}
                    isAnimationActive={false}
                  />
                )}
                <Area
                  type="linear"
                  dataKey="forecastMw"
                  fill="#b8d6bd"
                  fillOpacity={0.12}
                  stroke="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Line
                  name="As-of forecast"
                  dataKey="forecastMw"
                  type="linear"
                  stroke="#2f795e"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {actuals && (
                  <Line
                    className="actual-generation"
                    name="Actual generation"
                    dataKey="actualMw"
                    type="linear"
                    stroke="#718bbb"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            <span>
              {history.rangeAvailable
                ? `P10–P90 · ${history.metrics.pairedHours} past hours · descriptive, not calibrated`
                : "Range unavailable · fewer than 48 past hours"}
            </span>
            <span>
              P90 shortfall{" "}
              <strong>
                {history.rangeAvailable
                  ? gw(history.metrics.p90ShortfallMw)
                  : "—"}{" "}
                GW
              </strong>
            </span>
          </div>
        </section>
      </div>
      {actuals && (
        <motion.section
          className="hindsight-strip"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.14 }}
        >
          <span className="tiny-badge">HINDSIGHT</span>
          <strong>Delivery check</strong>
          <span>
            MAE <b>{gw(m.maeMw)} GW</b>
          </span>
          <span>
            Bias{" "}
            <b>
              {m.biasMw != null && m.biasMw > 0 ? "+" : ""}
              {gw(m.biasMw)} GW
            </b>
          </span>
          <span>
            Paired hours <b>{m.pairedHours}/24</b>
          </span>
        </motion.section>
      )}
      <details className="hourly-details">
        <summary>
          <span>
            Hourly data <small>MW · GMT</small>
          </span>
          <span className="summary-plus">+</span>
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              As-of wind forecasts and optional hindsight actuals in megawatts
            </caption>
            <thead>
              <tr>
                <th>Delivery hour</th>
                <th>Forecast · MW</th>
                <th>Published · GMT</th>
                <th>Lead · hours</th>
                {actuals && (
                  <>
                    <th>Actual · MW</th>
                    <th>Error · MW</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.hour}>
                  <th>{row.hour}</th>
                  <td>{number(row.forecastMw)}</td>
                  <td>
                    {row.publishTime
                      ? `${displayDate(row.publishTime)} ${utcTime(row.publishTime)}`
                      : "Unavailable"}
                  </td>
                  <td>{number(row.leadHours, 1)}</td>
                  {actuals && (
                    <>
                      <td>{number(row.actualMw, 1)}</td>
                      <td
                        className={
                          (row.errorMw ?? 0) > 0 ? "error-positive" : ""
                        }
                      >
                        {row.errorMw != null && row.errorMw > 0 ? "+" : ""}
                        {number(row.errorMw, 1)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function WindTooltip({
  active,
  payload,
  label,
  actuals,
  showRange,
}: {
  active?: boolean;
  payload?: readonly {
    payload: {
      forecastMw: number | null;
      actualMw: number | null;
      lowerMw: number | null;
      upperMw: number | null;
      publishTime: string | null;
    };
  }[];
  label?: string | number;
  actuals: boolean;
  showRange: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{label} GMT</strong>
      <p>
        <span>As-of forecast</span>
        <b>{gw(row.forecastMw)} GW</b>
      </p>
      {actuals && (
        <p>
          <span>Actual</span>
          <b>{gw(row.actualMw)} GW</b>
        </p>
      )}
      {showRange && row.lowerMw != null && (
        <p>
          <span>Past-error range</span>
          <b>
            {gw(row.lowerMw)}–{gw(row.upperMw)} GW
          </b>
        </p>
      )}
      <small>
        Published{" "}
        {row.publishTime
          ? `${displayDate(row.publishTime)}, ${utcTime(row.publishTime)}`
          : "—"}{" "}
        GMT
      </small>
    </div>
  );
}

function Accuracy({
  data,
  selectedDate,
  selectDay,
}: {
  data: Month;
  selectedDate: string;
  selectDay: (date: string) => void;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const keyboard = useContext(KeyboardInput);
  useScene(scene, data.cutoffTime);
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      data.days.findIndex((day) => day.decisionDate === selectedDate),
    ),
  );
  const m = data.metrics;
  const chosen = data.days[index];
  const maximum = Math.max(1, ...data.days.map((day) => day.maeMw ?? 0));
  const valid = data.days.filter((day) => day.maeMw != null);
  const best = valid.reduce<(typeof valid)[number] | null>(
    (a, b) => (!a || b.maeMw! < a.maeMw! ? b : a),
    null,
  );
  const worst = valid.reduce<(typeof valid)[number] | null>(
    (a, b) => (!a || b.maeMw! > a.maeMw! ? b : a),
    null,
  );
  return (
    <div className="view-content accuracy-view" ref={scene}>
      <div className="context-line">
        <span>Retrospective · {data.cutoffTime} GMT cutoff</span>
        <span>2 Jan → 1 Feb delivery</span>
      </div>
      <section className="metrics" aria-label="Monthly error metrics">
        <Metric
          label="MAE"
          value={gw(m.maeMw)}
          unit="GW"
          detail="Typical miss"
          accent
        />
        <Metric
          label="RMSE"
          value={gw(m.rmseMw)}
          unit="GW"
          detail="Large-error weighted"
        />
        <Metric
          label="BIAS"
          value={`${(m.biasMw ?? 0) > 0 ? "+" : ""}${gw(m.biasMw)}`}
          unit="GW"
          detail="Forecast − actual"
        />
        <Metric
          label="WAPE"
          value={number(m.wapePct, 1)}
          unit="%"
          detail="Relative error"
        />
      </section>
      <section
        className="month-overview"
        data-enter
        aria-labelledby="month-title"
      >
        <div className="section-top">
          <h2 id="month-title">A month of forecast error.</h2>
          <span className="unit-label">Daily MAE · 0–{gw(maximum)} GW</span>
        </div>
        <div className="month-scrubber">
          <div
            className="error-columns"
            role="img"
            aria-label={`Daily mean absolute errors. Smallest: ${best ? displayDate(best.decisionDate) : "unavailable"}, ${gw(best?.maeMw)} GW. Largest: ${worst ? displayDate(worst.decisionDate) : "unavailable"}, ${gw(worst?.maeMw)} GW. Use the day slider below for exact values.`}
          >
            {data.days.map((day, i) => (
              <div
                className="error-column"
                key={day.day}
                data-selected={i === index}
              >
                <span
                  className="error-bar"
                  data-bar
                  style={{
                    height: `${Math.max(1, ((day.maeMw ?? 0) / maximum) * 100)}%`,
                  }}
                  data-missing={day.maeMw == null}
                />
                <span className="column-day">
                  {[0, 7, 14, 21, 30].includes(i) ? day.day : ""}
                </span>
              </div>
            ))}
            <motion.span
              className="day-guide"
              aria-hidden="true"
              animate={{ transform: `translateX(${index * 100}%)` }}
              transition={{ duration: 0 }}
              style={{ width: `${100 / data.days.length}%` }}
            />
          </div>
          <input
            className="day-scrubber"
            type="range"
            min="1"
            max={data.days.length}
            step="1"
            value={index + 1}
            aria-label="Inspect a January decision"
            aria-valuetext={`${displayDate(chosen.decisionDate)}, MAE ${gw(chosen.maeMw)} gigawatts`}
            onChange={(event) => setIndex(Number(event.target.value) - 1)}
          />
        </div>
        <div className="day-preview">
          <div>
            <span className="eyebrow">DECISION → DELIVERY</span>
            <strong>
              {displayDate(chosen.decisionDate)}{" "}
              <span>→ {displayDate(chosen.deliveryDate)}</span>
            </strong>
          </div>
          <div>
            <span className="eyebrow">MAE</span>
            <strong>
              <RollingValue value={gw(chosen.maeMw)} instant />{" "}
              <small>GW</small>
            </strong>
          </div>
          <div>
            <span className="eyebrow">BIAS</span>
            <strong>
              <RollingValue
                value={`${(chosen.biasMw ?? 0) > 0 ? "+" : ""}${gw(chosen.biasMw)}`}
                instant
              />{" "}
              <small>GW</small>
            </strong>
          </div>
          <motion.button
            className="replay-day"
            whileTap={reduced || keyboard ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.12 }}
            onClick={() => selectDay(chosen.decisionDate)}
            aria-label={`Replay ${displayDate(chosen.decisionDate)} decision`}
          >
            Replay day <ArrowUpRight size={17} />
          </motion.button>
        </div>
        <div className="month-extremes">
          <span>
            Smallest <b>{best ? displayDate(best.decisionDate) : "—"}</b> ·{" "}
            {gw(best?.maeMw)} GW
          </span>
          <span>
            Largest <b>{worst ? displayDate(worst.decisionDate) : "—"}</b> ·{" "}
            {gw(worst?.maeMw)} GW
          </span>
        </div>
      </section>
      <section
        className="error-balance"
        aria-label="Over-forecast hours"
        data-enter
      >
        <div>
          <span>
            <b>{m.overForecastHours}</b> over-forecast hours
          </span>
          <span>
            <b>{m.pairedHours - m.overForecastHours}</b> at or below actual
          </span>
        </div>
        <div className="balance-track" aria-hidden="true">
          <span
            style={{
              width: `${m.pairedHours ? (m.overForecastHours / m.pairedHours) * 100 : 0}%`,
            }}
          />
        </div>
        <small>
          {m.pairedHours}/{m.expectedHours} paired hours ·{" "}
          {data.days.filter((day) => day.pairedHours === 24).length}/31 complete
          days
        </small>
      </section>
      <details className="hourly-details daily-results">
        <summary>
          <span>
            All daily results <small>MW · January decisions</small>
          </span>
          <span className="summary-plus">+</span>
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              January decision cohort, paired forecast errors in megawatts
            </caption>
            <thead>
              <tr>
                <th>Decision → delivery</th>
                <th>MAE · MW</th>
                <th>RMSE · MW</th>
                <th>Bias · MW</th>
                <th>WAPE</th>
                <th>Paired hours</th>
                <th>
                  <span className="sr-only">Replay</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.decisionDate}>
                  <th>
                    {displayDate(day.decisionDate)}{" "}
                    <span className="muted">
                      → {displayDate(day.deliveryDate)}
                    </span>
                  </th>
                  <td>{number(day.maeMw)}</td>
                  <td>{number(day.rmseMw)}</td>
                  <td className={(day.biasMw ?? 0) > 0 ? "error-positive" : ""}>
                    {day.biasMw != null && day.biasMw > 0 ? "+" : ""}
                    {number(day.biasMw)}
                  </td>
                  <td>{number(day.wapePct, 1)}%</td>
                  <td>{day.pairedHours}/24</td>
                  <td>
                    <button
                      className="replay"
                      onClick={() => selectDay(day.decisionDate)}
                      aria-label={`Replay ${displayDate(day.decisionDate)} decision`}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="boundary-note">
        Hindsight review. These results never feed an earlier decision. Missing
        pairs are excluded.
      </p>
    </div>
  );
}

function MethodNotes() {
  return (
    <div className="method-notes-content">
      <div className="method-steps">
        <article>
          <span>01</span>
          <div>
            <h3>One decision, one cutoff</h3>
            <p>
              Choose a decision date in January 2026 and a GMT cutoff. Delivery
              is the following day, including 1 February for the 31 January
              decision. For each delivery hour, use the most recent forecast
              with <code>publishTime ≤ cutoff</code>. If none exists, show a
              gap.
            </p>
            <p>
              The default 09:00 GMT is an analyst assumption before the morning
              day-ahead auctions. It is adjustable; no single market gate
              closure is assumed.
            </p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h3>Compare like with like</h3>
            <p>
              WINDFOR in this snapshot is hourly. FUELHH gives mean MW per
              half-hour. An hourly actual is the arithmetic mean of its two
              half-hours. Both are required; incomplete hours are excluded. The
              hourly forecast is used at its reported hour, without
              interpolation.
            </p>
            <p>
              All dates are GMT/UTC in January. MW measures power; an hour of 1
              MW contributes 1 MWh. Daily GWh is the sum of the 24 hourly MW
              values divided by 1,000.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h3>Make the error interpretable</h3>
            <p>
              <code>Error = forecast − actual</code>. Positive error means less
              wind arrived than expected: exposure to a wind shortfall. Negative
              error means more wind arrived than expected.
            </p>
            <dl className="formulas">
              <div>
                <dt>MAE</dt>
                <dd>mean(|error|)</dd>
              </div>
              <div>
                <dt>RMSE</dt>
                <dd>√mean(error²)</dd>
              </div>
              <div>
                <dt>Bias</dt>
                <dd>mean(error)</dd>
              </div>
              <div>
                <dt>WAPE</dt>
                <dd>100 × Σ|error| / Σactual</dd>
              </div>
            </dl>
            <p>
              All metrics use matched forecast/actual hours. WAPE is unavailable
              if total actual generation is zero. Missing observations never
              become zeros.
            </p>
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h3>Keep the risk view honest</h3>
            <p>
              The desk’s past-error range uses only earlier January decisions at
              the same cutoff, with completed delivery hours and actuals
              published by the selected decision. It requires at least 48 paired
              hours. Its lower and upper edges are forecast minus the 90th and
              10th percentile errors, floored at zero.
            </p>
            <p>
              This is an empirical error range, not a calibrated confidence
              interval. P90 shortfall is the 90th percentile of signed
              forecast-minus-actual errors, floored at zero. Hourly observations
              are correlated and the sample is small. The full-month accuracy
              review is retrospective.
            </p>
          </div>
        </article>
        <article>
          <span>05</span>
          <div>
            <h3>Know the boundary of the data</h3>
            <p>
              National wind generation is the only input. This does not model
              your portfolio’s demand, contracted generation, prices, costs,
              embedded-wind coverage or an optimal thermal purchase. No
              procurement quantity is recommended.
            </p>
            <p>
              The snapshot contains the latest returned actuals at retrieval,
              not a complete archive of every historical actual revision.
              Forecast publication timestamps are respected. The prior-risk view
              additionally excludes actual records published after its cutoff.
            </p>
            <div className="source-links">
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
                target="_blank"
                rel="noreferrer"
              >
                WINDFOR documentation <ExternalLink size={13} />
              </a>
              <a
                href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
                target="_blank"
                rel="noreferrer"
              >
                FUELHH documentation <ExternalLink size={13} />
              </a>
              <a href="/api/docs" target="_blank" rel="noreferrer">
                Explore the Python API <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
