import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import Landing from "./Landing";
import "./style.css";
import "./landing.css";

const App = React.lazy(() => import("./App"));
const query = new URLSearchParams(window.location.search);
// Keep original shared decision links working alongside the new /desk entry point.
const openDesk =
  window.location.pathname === "/desk" ||
  ["date", "cutoff", "view"].some((key) => query.has(key));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      {openDesk ? (
        <React.Suspense
          fallback={
            <div className="load-state" role="status">
              Opening the desk…
            </div>
          }
        >
          <App />
        </React.Suspense>
      ) : (
        <Landing />
      )}
    </MotionConfig>
  </React.StrictMode>,
);
