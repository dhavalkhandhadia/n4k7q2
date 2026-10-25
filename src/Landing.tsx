import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import panorama from "./assets/wind-panorama.webp";

export default function Landing() {
  const reduceMotion = useReducedMotion();
  const [seenIntro] = useState(() => {
    try {
      return sessionStorage.getItem("northline:intro") === "seen";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.title = "Northline — Tomorrow, in view.";
    try {
      sessionStorage.setItem("northline:intro", "seen");
    } catch {
      // Storage can be disabled; the page remains fully usable.
    }
  }, []);

  return (
    <div className="landing">
      <a className="skip-link" href="#landing-content">
        Skip to content
      </a>
      <header className="landing-header">
        <a className="wordmark" href="/" aria-label="Northline home">
          NORTHLINE
        </a>
        <a className="method-link" href="/desk?view=method">
          Methodology
        </a>
      </header>
      <main id="landing-content" className="landing-main">
        <motion.section
          className="landing-intro"
          initial={
            seenIntro || reduceMotion ? false : { transform: "translateY(8px)" }
          }
          animate={{ transform: "translateY(0px)" }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          aria-labelledby="landing-title"
        >
          <h1 id="landing-title">
            Tomorrow,
            <br />
            in view.
          </h1>
          <div className="landing-action">
            <p>
              Wind forecasts for
              <br />
              the day-ahead desk.
            </p>
            <motion.a
              className="desk-link"
              href="/desk"
              whileHover={reduceMotion ? undefined : "hover"}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.12 }}
            >
              Open desk
              <motion.span
                aria-hidden="true"
                variants={{ hover: { transform: "translate(2px, -2px)" } }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              >
                ↗
              </motion.span>
            </motion.a>
          </div>
        </motion.section>
        <figure className="landing-figure">
          <div className="landing-image">
            <img
              src={panorama}
              width="1983"
              height="793"
              fetchPriority="high"
              alt="An illustrative offshore wind farm in the North Sea, with pale morning light over the water."
            />
          </div>
          <figcaption>
            <span>GB wind · January 2026</span>
            <span>Elexon data</span>
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
