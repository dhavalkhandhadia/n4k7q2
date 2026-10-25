import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { RollingNumber } from "./components/RollingNumber";

export const KeyboardInput = createContext(false);

export const ease = [0.23, 1, 0.32, 1] as const;

// GSAP owns scene choreography; Motion owns the controls inside each scene.
export function useScene(scope: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    if (
      !scope.current ||
      scope.current.closest("main")?.dataset.input === "keyboard"
    )
      return;
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const entering = scope.current!.querySelectorAll("[data-enter]");
        if (entering.length)
          gsap.from(entering, {
            y: 12,
            opacity: 0.4,
            duration: 0.35,
            stagger: 0.035,
            ease: "power3.out",
            clearProps: "transform,opacity",
          });
        const bars = scope.current!.querySelectorAll("[data-bar]");
        if (bars.length)
          gsap.from(bars, {
            scaleY: 0.04,
            transformOrigin: "bottom",
            duration: 0.45,
            stagger: 0.012,
            ease: "power3.out",
            clearProps: "transform",
          });
        scope
          .current!.querySelectorAll<SVGPathElement>("[data-draw]")
          .forEach((path) => {
            const length = path.getTotalLength();
            gsap.fromTo(
              path,
              { strokeDasharray: length, strokeDashoffset: length },
              {
                strokeDashoffset: 0,
                duration: 0.65,
                ease: "power2.inOut",
                clearProps: "strokeDasharray,strokeDashoffset",
              },
            );
          });
      },
      scope.current,
    );
    return () => media.revert();
  }, [key, scope]);
}

export function RollingValue({
  value,
  instant = false,
}: {
  value: string;
  instant?: boolean;
}) {
  const keyboard = useContext(KeyboardInput);
  const numeric = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(numeric))
    return <span className="rolling-value">{value}</span>;
  const digits = value.split(".")[1]?.length ?? 0;
  return (
    <RollingNumber
      className="rolling-value"
      value={numeric}
      instant={instant || keyboard}
      locales="en-GB"
      format={{
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        signDisplay: value.startsWith("+") ? "always" : "auto",
      }}
    />
  );
}

export function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [instant, setInstant] = useState(false);
  return (
    <label className={`quiet-toggle ${disabled ? "unavailable" : ""}`}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked && !disabled}
        disabled={disabled}
        onPointerDown={() => setInstant(false)}
        onKeyDown={() => setInstant(true)}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className="toggle-track"
        aria-hidden="true"
        data-checked={checked && !disabled}
      >
        <motion.span
          animate={{
            transform: `translateX(${checked && !disabled ? 14 : 0}px)`,
          }}
          transition={
            reduced || instant
              ? { duration: 0 }
              : { type: "spring", stiffness: 360, damping: 38 }
          }
        >
          {checked && !disabled ? (
            <svg viewBox="0 0 12 12">
              <path d="m3 6 2 2 4-4" />
            </svg>
          ) : null}
        </motion.span>
      </span>
      <span>{label}</span>
    </label>
  );
}
