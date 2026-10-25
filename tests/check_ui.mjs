import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { outputFiles } = buildSync({
  entryPoints: ["src/Method.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "motion/react", "gsap"],
  loader: { ".css": "empty", ".module.css": "empty" },
});
const compiled = { exports: {} };
vm.runInNewContext(outputFiles[0].text, {
  module: compiled,
  exports: compiled.exports,
  require: createRequire(import.meta.url),
  console,
  process,
});
const Method = compiled.exports.default;
const render = (data, error = null) =>
  renderToStaticMarkup(
    createElement(Method, {
      data,
      error,
      retry() {},
      children: "Detailed assumptions",
    }),
  );

const loading = render(null);
assert.match(loading, /Loading example/);
assert.doesNotMatch(loading, /No paired observation|No publication/);
assert.match(render(null, "Network unavailable"), /Example unavailable/);
assert.match(render(null, "Network unavailable"), />Retry</);
const day = {
  publicationTimes: [],
  cutoff: "2026-01-14T09:00:00Z",
  deliveryDate: "2026-01-15",
  retrievedAt: "2026-10-25T07:05:00Z",
  rows: [],
};
assert.match(render(day), /No paired observation/);
assert.doesNotMatch(render(day), /Loading example/);
const paired = render({
  ...day,
  publicationTimes: ["2026-01-14T07:30:00Z"],
  rows: [{ hour: "00:00", forecastMw: 12000, actualMw: 10000, errorMw: 2000 }],
});
assert.match(paired, /Retrospective example/);
assert.match(paired, /2\.00/);
assert.doesNotMatch(paired, /Loading example|No paired observation/);
console.log("Methodology loading, error, empty and populated states pass.");
