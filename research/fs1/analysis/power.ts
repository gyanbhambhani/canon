/**
 * FS-1 power analysis on the pilot.
 *   npx tsx --conditions=source analysis/power.ts --results 'results/pilot-*.jsonl'
 *
 * For each frontier model:
 * - baseline: the arm (direct or openapi) with the higher pilot pass rate; a tie goes to openapi,
 *   the arm the plan calls the one that matters;
 * - runs per task R: the largest R ≤ 3 whose projected cost (pilot dollars per run × 60 tasks × 3
 *   arms × R) stays within 90% of the $100 cap;
 * - the standard error of the mean paired difference over the main run's tasks, conservatively
 *   treating all of the pilot's single-run variance as between-task variance (which more runs per
 *   task do not reduce): SE = sd(pilot differences) / sqrt(n_tasks);
 * - the margin: m = 2.8 × SE (so that a true difference of zero shows non-inferiority with 80%
 *   power at a two-sided 95% interval), rounded up to a whole 5 percentage points, at least 10;
 * - the smallest detectable effect per metric: 2.8 × SE for that metric's paired differences.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARMS, FS1, METRICS, load, paired, perTask, type Rec } from "./analyze";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const recs: Rec[] = load(arg("results", "results/pilot-*.jsonl")!.split(","));
const FRONTIER = (arg("frontier", "claude-opus-5-5,gpt-6.2-sol")!).split(",");
const CAP = Number(arg("cap", "100"));
const tasksAll = readdirSync(join(FS1, "tasks")).filter((d) => {
  try {
    return !!JSON.parse(readFileSync(join(FS1, "tasks", d, "task.json"), "utf8"));
  } catch {
    return false;
  }
});
const N_TASKS = tasksAll.length;
const N_CHANGE = tasksAll.filter((d) => JSON.parse(readFileSync(join(FS1, "tasks", d, "task.json"), "utf8")).kind === "change").length;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const pp = (x: number) => `${(100 * x).toFixed(1)} pp`;

const out: Record<string, unknown> = { nTasks: N_TASKS, nChange: N_CHANGE, models: {} as Record<string, unknown> };
const lines: string[] = [`Main run: ${N_TASKS} tasks (${N_CHANGE} change), 3 arms. Pilot records: ${recs.length}.`, ""];
const models = [...new Set(recs.map((r) => r.model))].sort();
for (const model of models) {
  const keep = () => true;
  const passBy = Object.fromEntries(ARMS.map((a) => [a, perTask(recs, model, a, "pass", keep)]));
  const rate = (a: string) => mean([...passBy[a].values()]);
  const baseline = rate("direct") > rate("openapi") ? "direct" : "openapi";
  const runsOf = recs.filter((r) => r.model === model);
  const perRun = runsOf.some((r) => r.dollars === null) ? null : mean(runsOf.map((r) => r.dollars ?? 0));
  const perRunWall = mean(runsOf.map((r) => r.wallMs / 1000));
  let runs = 1;
  if (perRun !== null && perRun > 0) {
    for (const R of [3, 2, 1]) {
      if (perRun * N_TASKS * 3 * R <= 0.9 * CAP) {
        runs = R;
        break;
      }
    }
  } else runs = 3; // free (local) models: the time budget decides, see below
  const mde: Record<string, string> = {};
  let margin = 0.1;
  for (const metric of ["pass", "firstRound", "change", "mismatch", "agreement", "falseAcceptance"]) {
    const d = paired(perTask(recs, model, "canon", metric, keep), perTask(recs, model, baseline, metric, keep));
    const n = metric === "change" ? N_CHANGE : N_TASKS;
    const se = sd(d) / Math.sqrt(n);
    mde[METRICS[metric].label] = `${pp(2.8 * se)} (pilot sd ${sd(d).toFixed(3)} over ${d.length} tasks)`;
    if (metric === "pass") margin = Math.max(0.1, Math.ceil((2.8 * se) / 0.05 - 1e-9) * 0.05);
  }
  const projected = perRun === null ? null : perRun * N_TASKS * 3 * runs;
  (out.models as Record<string, unknown>)[model] = {
    passRates: Object.fromEntries(ARMS.map((a) => [a, rate(a)])), baseline, perRunDollars: perRun, perRunWallSeconds: perRunWall,
    runsPerTask: runs, projectedDollars: projected, margin, smallestDetectable: mde, frontier: FRONTIER.includes(model),
  };
  lines.push(`## ${model}${FRONTIER.includes(model) ? "" : " (exploratory candidate)"}`,
    `Pilot pass rates: ${ARMS.map((a) => `${a} ${(100 * rate(a)).toFixed(0)}%`).join(", ")}. Baseline: ${baseline}.`,
    `Dollars per run ${perRun === null ? "unknown" : `$${perRun.toFixed(3)}`}, wall time ${perRunWall.toFixed(0)} s per run.`,
    `Runs per task: ${runs}; projected main-run cost ${projected === null ? "unknown" : `$${projected.toFixed(2)}`}.`,
    `Margin from this model's pilot: ${pp(margin)}.`,
    ...Object.entries(mde).map(([k, v]) => `- smallest detectable effect, ${k}: ${v}`), "");
}
const frontierMargins = FRONTIER.map((m) => ((out.models as Record<string, { margin: number }>)[m]?.margin ?? 0.1));
const margin = Math.max(...frontierMargins);
out.margin = margin;
lines.push(`Pre-registered margin (the larger of the frontier models'): ${pp(margin)}.`);
console.log(lines.join("\n"));
console.log("\nJSON " + JSON.stringify(out));
