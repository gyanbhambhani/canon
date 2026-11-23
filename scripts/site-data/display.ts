/**
 * Display strings for the landing page and README, so no page formats or types a number itself.
 * Ranges span the two models ("93–96%"); a single value is shown when both round the same.
 */
import type { Benchmark } from "./benchmark.js";

const range = (xs: number[], f: (x: number) => string, unit = "") => {
  const lo = f(Math.min(...xs));
  const hi = f(Math.max(...xs));
  return lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`;
};
const pct0 = (x: number) => `${Math.round(100 * x)}`;
const dec2 = (x: number) => x.toFixed(2);
const n = (x: number) => x.toLocaleString("en-US");

export function buildDisplay(stats: { referenceTokens: number; version: string }, b: Benchmark, v0: Benchmark) {
  const c = b.byModel.map((m) => m.canon);
  const t = b.byModel.map((m) => m.typescript);
  return {
    version: stats.version,
    referenceTokens: n(stats.referenceTokens),
    runs: n(b.runs),
    canonRuns: n(b.canonRuns),
    tasks: n(b.tasks),
    hardTasks: n(b.hardTasks),
    runsPerTask: n(b.runsPerTask),
    modelCount: n(b.models.length),
    models: b.models.join(" · "),
    canonCorrect: range(c.map((x) => x.correct), pct0, "%"),
    tsCorrect: range(t.map((x) => x.correct), pct0, "%"),
    canonFirstPassRange: range(c.map((x) => x.firstPass), pct0, "%"),
    tsFirstPass: range(t.map((x) => x.firstPass), pct0, "%"),
    turnsRange: range(c.map((x) => x.turns), dec2),
    tsTurns: range(t.map((x) => x.turns), dec2),
    canonDistinctRange: range(c.map((x) => x.distinct), dec2),
    tsDistinctRange: range(t.map((x) => x.distinct), dec2),
    tokenMultipleRange: range(b.byModel.map((m) => m.tokenMultiple), (x) => x.toFixed(1), "x"),
    timeMultipleRange: range(b.byModel.map((m) => m.timeMultiple), (x) => x.toFixed(1), "x"),
    v0Runs: n(v0.runs),
    v0CanonDistinctRange: range(v0.byModel.map((m) => m.canon.distinct), dec2),
    v0CanonFirstPassRange: range(v0.byModel.map((m) => m.canon.firstPass), pct0, "%"),
    costMultipleRange: range(
      b.byModel.filter((m) => m.canon.costPerCorrect !== null).map((m) => m.canon.costPerCorrect! / m.typescript.costPerCorrect!),
      (x) => x.toFixed(1),
      "x",
    ),
    outputTokensCanon: range(c.map((x) => x.outputTokens), (x) => n(Math.round(x))),
    outputTokensTs: range(t.map((x) => x.outputTokens), (x) => n(Math.round(x))),
    failedFirst: n(b.byModel.reduce((a, m) => a + m.failedFirst, 0)),
    fixedInOne: n(b.byModel.reduce((a, m) => a + m.fixedInOne, 0)),
  };
}

export type Display = ReturnType<typeof buildDisplay>;
