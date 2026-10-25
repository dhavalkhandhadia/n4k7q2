// Piruicy · Rolling number · https://piruicy.com/components/rolling-number
// Copyright (c) 2026 Dhaval Khandhadia. MIT + Commons Clause: use it in your products; do not sell it. See LICENSE.

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  usePresence,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import styles from "./rolling-number.module.css";

// A number whose digits roll like an odometer. Behaviour measured from a live
// reference (spring, fade, roll distance per trend), not copied from source:
//  - every digit is a column: the current digit in flow, plus 9 digits above and
//    9 below in cyclic order, clipped to one slot by a window with a faded edge
//  - a change shifts the column by the roll distance and springs it back to 0
//  - columns enter (width 0 → auto, fade in, rolling up from 0) and leave
//    (rolling to 0, fading and narrowing) as the digit count changes
export type Trend = "auto" | "up" | "down";

// Critically damped (ζ = 1.00 when fitted), ω ≈ 9.3 rad/s: no overshoot, ~1s to rest.
// Rolls and widths share it. Measured, so k = ω² ≈ 86 and c = 2ω ≈ 18.6.
const SPRING = {
  type: "spring",
  stiffness: 86,
  damping: 18.6,
  mass: 1,
} as const;
// Rolls are measured in digit slots. Motion's default rest threshold for a move of more
// than 5 units is 0.5, so a long roll would stop up to half a digit (~69px) short of rest
// and jump home in one frame. Explicit thresholds make it stop only when it has arrived.
const ROLL = {
  ...SPRING,
  velocity: 0,
  restDelta: 0.001,
  restSpeed: 0.01,
} as const;
const FADE = { duration: 1, ease: [0, 0, 0.58, 1] } as const; // CSS ease-out
const INSTANT = { duration: 0 } as const;

// Slots the column starts away from rest. Positive: shifted down, so the digits
// travel up as it settles.
//  auto  each digit takes the direct way: up if it grows, down if it shrinks
//  up    always up, wrapping through 9 → 0
//  down  always down, wrapping through 0 → 9
export function rollSlots(from: number, to: number, trend: Trend) {
  if (from === to) return 0;
  if (trend === "up") return (to - from + 10) % 10;
  if (trend === "down") return -((from - to + 10) % 10);
  return to - from;
}

type Cell = { key: string; digit?: number; char?: string };

function split(
  value: number,
  locales?: Intl.LocalesArgument,
  options?: Intl.NumberFormatOptions,
) {
  const parts = new Intl.NumberFormat(locales, options).formatToParts(value);
  const pre: Cell[] = [];
  const body: Cell[] = [];
  const post: Cell[] = [];
  const integerDigits = parts
    .filter((p) => p.type === "integer")
    .reduce((n, p) => n + p.value.length, 0);
  let seen = 0;
  let fraction = 0;
  let inNumber = false;
  for (const part of parts) {
    if (part.type === "integer") {
      inNumber = true;
      // Keyed from the right, so the ones column stays the ones column as the number grows.
      for (const ch of part.value)
        body.push({
          key: `int-${integerDigits - 1 - seen++}`,
          digit: Number(ch),
        });
    } else if (part.type === "group") {
      body.push({ key: `group-${integerDigits - seen}`, char: part.value });
    } else if (part.type === "decimal") {
      body.push({ key: "decimal", char: part.value });
    } else if (part.type === "fraction") {
      for (const ch of part.value)
        body.push({ key: `frac-${fraction++}`, digit: Number(ch) });
    } else {
      (inNumber ? post : pre).push({
        key: `${inNumber ? "post" : "pre"}-${part.type}-${part.value}`,
        char: part.value,
      });
    }
  }
  return { pre, body, post, text: parts.map((p) => p.value).join("") };
}

const cycle = (digit: number) =>
  Array.from({ length: 9 }, (_, i) => (digit + i + 1) % 10);
const clamp = (value: number) => Math.max(-9, Math.min(9, value));

interface Shared {
  trendRef: MutableRefObject<Trend>;
  reduced: boolean;
}

function Digit({
  digit,
  enter,
  trendRef,
  reduced,
}: Shared & { digit: number; enter: boolean }) {
  const [present, safeToRemove] = usePresence();
  const [leaving, setLeaving] = useState<number | null>(null);
  // A column that is leaving can't get new props, so it rolls itself to 0.
  const shown = leaving ?? digit;
  const slots = useMotionValue(0);
  const y = useTransform(slots, (v) => `${v * 100}%`);
  const previous = useRef(enter ? 0 : digit);
  const running = useRef<AnimationPlaybackControls | null>(null);

  useLayoutEffect(() => {
    if (previous.current === shown) return;
    const travel = rollSlots(previous.current, shown, trendRef.current);
    previous.current = shown;
    running.current?.stop();
    if (reduced) {
      slots.set(0);
      return;
    }
    // Retargeting mid-roll starts from where the column is, so nothing jumps.
    slots.set(clamp(slots.get() + travel));
    // velocity: 0 (in ROLL), because set() above reads as a huge velocity to animate().
    running.current = animate(slots, 0, ROLL);
  }, [shown, reduced, slots, trendRef]);

  useLayoutEffect(() => {
    if (!present) setLeaving(0);
  }, [present]); // before paint, so the roll starts on the first frame
  // The cell's own exit (width and fade) decides when the column goes; the roll is done by then.
  useEffect(() => {
    if (leaving !== null) safeToRemove?.();
  }, [leaving, safeToRemove]);

  return (
    <motion.span className={styles.column} style={{ y }}>
      <span className={styles.strip} data-side="above">
        {cycle(shown).map((n) => (
          <span className={styles.slot} key={n}>
            {n}
          </span>
        ))}
      </span>
      <span className={styles.slot}>{shown}</span>
      <span className={styles.strip} data-side="below">
        {cycle(shown).map((n) => (
          <span className={styles.slot} key={n}>
            {n}
          </span>
        ))}
      </span>
    </motion.span>
  );
}

function Cells({
  cells,
  first,
  trendRef,
  reduced,
}: Shared & { cells: Cell[]; first: boolean }) {
  const width = reduced ? INSTANT : SPRING;
  const fade = reduced ? INSTANT : FADE;
  return (
    <AnimatePresence initial={false}>
      {cells.map((cell) => (
        <motion.span
          key={cell.key}
          className={styles.cell}
          initial={{ width: 0, opacity: 0 }}
          animate={{
            width: "auto",
            opacity: 1,
            transition: { width: width, opacity: fade },
          }}
          exit={{
            width: 0,
            opacity: 0,
            transition: { width: width, opacity: fade },
          }}
        >
          {cell.digit !== undefined && !Number.isNaN(cell.digit) ? (
            <Digit
              digit={cell.digit}
              enter={!first}
              trendRef={trendRef}
              reduced={reduced}
            />
          ) : (
            <span className={styles.symbol}>{cell.char}</span>
          )}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}

export interface RollingNumberProps {
  instant?: boolean;
  value: number;
  trend?: Trend;
  locales?: Intl.LocalesArgument;
  format?: Intl.NumberFormatOptions;
  className?: string;
}

export function RollingNumber({
  value,
  instant = false,
  trend = "auto",
  locales,
  format,
  className,
}: RollingNumberProps) {
  const preference = useReducedMotion();
  const reduced = instant || (preference ?? false);
  const trendRef = useRef(trend);
  trendRef.current = trend;
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);
  const { pre, body, post, text } = split(value, locales, format);
  const first = firstRender.current;

  return (
    <span
      className={className ? `${styles.root} ${className}` : styles.root}
      data-piruicy="rolling-number"
    >
      <span className={styles.text}>{text}</span>
      <span className={styles.visual} aria-hidden="true">
        <span className={styles.edge}>
          <Cells
            cells={pre}
            first={first}
            trendRef={trendRef}
            reduced={reduced}
          />
        </span>
        <span className={styles.window}>
          <Cells
            cells={body}
            first={first}
            trendRef={trendRef}
            reduced={reduced}
          />
        </span>
        <span className={styles.edge}>
          <Cells
            cells={post}
            first={first}
            trendRef={trendRef}
            reduced={reduced}
          />
        </span>
      </span>
    </span>
  );
}
