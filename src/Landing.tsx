import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import panorama from "./assets/wind-panorama.webp";

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const scene = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [seenIntro] = useState(() => {
    try {
      return sessionStorage.getItem("northline:intro") === "seen";
    } catch {
      return true;
    }
  });

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        if (!seenIntro) {
          const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
          intro
            .from(".landing-title-line > span", {
              yPercent: 65,
              opacity: 0.25,
              duration: 0.85,
              stagger: 0.09,
            })
            .from(
              ".landing-action",
              {
                y: 14,
                opacity: 0.3,
                duration: 0.55,
                clearProps: "transform,opacity",
              },
              0.18,
            )
            .from(
              ".landing-figure",
              {
                y: 18,
                opacity: 0.5,
                duration: 0.7,
                clearProps: "transform,opacity",
              },
              0.12,
            );
        }
        gsap.fromTo(
          ".landing-image img",
          { yPercent: -3, scale: 1.08 },
          {
            yPercent: 3,
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: ".landing-image",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      },
      scene.current!,
    );
    return () => media.revert();
  }, [seenIntro]);

  useEffect(() => {
    document.title = "Northline — Tomorrow, in view.";
    try {
      sessionStorage.setItem("northline:intro", "seen");
    } catch {
      // Storage can be disabled; the page remains fully usable.
    }
  }, []);

  return (
    <div className="landing" ref={scene}>
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
        <section className="landing-intro" aria-labelledby="landing-title">
          <h1 id="landing-title">
            <span className="landing-title-line">
              <span>Tomorrow,</span>
            </span>
            <span className="landing-title-line">
              <span>in view.</span>
            </span>
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
        </section>
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
