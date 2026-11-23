/**
 * FS-1 analysis (pre-registered; PREREGISTRATION.md pins this file's hash).
 *
 *   npx tsx --conditions=source analysis/analyze.ts --results 'results/main-*.jsonl' [--config analysis/config.json] [--json out.json]
 *
 * Unit of analysis: the task. Runs are averaged per (task, arm, model). Canon is compared with the
 * pre-registered baseline arm (config.baseline[model]) on paired per-task differences; 95% intervals
 * are percentile intervals from 10,000 bootstrap resamples of tasks (seed 2026). Every analysis is
 * reported on all tasks and without the adapted ones.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FS1 = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ARMS = ["direct", "openapi", "canon"] as const;
export type Arm = (typeof ARMS)[number];

export interface Rec {
  key: string;
  task: string;
  kind: "feature" | "change";
  arm: Arm;
  model: string;
  run: number;
  pass: boolean;
  mismatch: boolean;
  checksOk: boolean;
  falseAcceptance: boolean;
  validation: { feature: string; agreement?: number }[];
  editRounds: number;
  turns: number;
  finished: string;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  referenceTokens: number;
  dollars: number | null;
  wallMs: number;
  error?: string;
  firstRound?: { pass: boolean; mismatch: boolean } | null;
}

/**
 * First-round pass: the hidden verdict after the first edit round. Runs recorded before the runner
 * measured it (the pilot) approximate it as "passed, in one edit round".
 */
export function firstRoundPass(r: Rec): number {
  if (r.firstRound !== undefined) return r.firstRound ? +r.firstRound.pass : 0;
  return +(r.pass && r.editRounds === 1);
}

export interface Config {
  /** the baseline arm per model, chosen from the pilot before the main run */
  baseline: Record<string, "direct" | "openapi">;
  /** non-inferiority margin, as a proportion (0.10 = 10 percentage points) */
  margin: number;
  /** models in the primary analysis (the frontier models) */
  frontier: string[];
}

// ---------------------------------------------------------------- loading

export function globFiles(pattern: string): string[] {
  const dir = join(FS1, dirname(pattern));
  const re = new RegExp("^" + basename(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f)) : [];
}

export function load(patterns: string[]): Rec[] {
  const byKey = new Map<string, Rec>();
  for (const p of patterns) {
    for (const f of globFiles(p)) {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const r = JSON.parse(line) as Rec;
        // a rerun of an infrastructure failure replaces the failed record, never the reverse
        const prev = byKey.get(r.key);
        if (!prev || infrastructureFailure(prev)) byKey.set(r.key, r);
      }
    }
  }
  return [...byKey.values()];
}

export function adaptedTasks(): Set<string> {
  const out = new Set<string>();
  for (const d of readdirSync(join(FS1, "tasks"))) {
    const f = join(FS1, "tasks", d, "task.json");
    if (existsSync(f) && JSON.parse(readFileSync(f, "utf8")).adapted) out.add(d);
  }
  return out;
}

/** An infrastructure failure: the model API failed (not a wrong answer). Such runs are rerun, never scored. */
export function infrastructureFailure(r: Rec): boolean {
  return r.finished === "error" && !!r.error && !/^refusal/.test(r.error);
}

// ---------------------------------------------------------------- statistics

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export interface Estimate {
  mean: number;
  lo: number;
  hi: number;
  n: number;
}

/** Mean over tasks with a 95% percentile bootstrap interval (10,000 resamples of tasks, seed 2026). */
export function bootstrap(values: number[], resamples = 10_000, seed = 2026): Estimate {
  const n = values.length;
  if (!n) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const r = mulberry32(seed);
  const means: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += values[Math.floor(r() * n)];
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return { mean: mean(values), lo: means[Math.floor(0.025 * resamples)], hi: means[Math.ceil(0.975 * resamples) - 1], n };
}

export type Outcome = "win" | "non-inferior" | "inconclusive" | "lose";

/** The plan's outcomes for a difference (Canon − baseline) and margin m. */
export function outcome(e: Estimate, margin: number): Outcome {
  if (e.lo > 0) return "win";
  if (e.lo > -margin) return "non-inferior";
  if (e.hi < -margin) return "lose";
  return "inconclusive";
}

// ---------------------------------------------------------------- per-task metrics

type Metric = (rs: Rec[]) => number | null;

export const METRICS: Record<string, { label: string; of: Metric; tasks?: (t: string, kind: string) => boolean; higherIsBetter: boolean }> = {
  pass: { label: "End-to-end pass rate", of: (rs) => mean(rs.map((r) => +r.pass)), higherIsBetter: true },
  mismatch: { label: "Mismatch rate", of: (rs) => mean(rs.map((r) => +r.mismatch)), higherIsBetter: false },
  firstRound: { label: "First-round pass (secondary)", of: (rs) => mean(rs.map(firstRoundPass)), higherIsBetter: true },
  change: { label: "Change-task success", of: (rs) => mean(rs.map((r) => +r.pass)), tasks: (_t, k) => k === "change", higherIsBetter: true },
  feature: { label: "Feature-task success", of: (rs) => mean(rs.map((r) => +r.pass)), tasks: (_t, k) => k === "feature", higherIsBetter: true },
  agreement: {
    label: "Validation agreement",
    of: (rs) => {
      const xs = rs.flatMap((r) => r.validation.flatMap((v) => (typeof v.agreement === "number" ? [v.agreement] : [])));
      return xs.length ? mean(xs) : null;
    },
    higherIsBetter: true,
  },
  falseAcceptance: {
    label: "False acceptance (of runs the arm's checks approved)",
    of: (rs) => {
      const ok = rs.filter((r) => r.checksOk);
      return ok.length ? mean(ok.map((r) => +!r.pass)) : null;
    },
    higherIsBetter: false,
  },
  checksOk: { label: "Arm's own checks pass at the end", of: (rs) => mean(rs.map((r) => +r.checksOk)), higherIsBetter: true },
  tokens: { label: "Tokens per run (input incl. cache + output)", of: (rs) => mean(rs.map((r) => r.usage.input + r.usage.cacheRead + r.usage.cacheWrite + r.usage.output)), higherIsBetter: false },
  outputTokens: { label: "Output tokens per run", of: (rs) => mean(rs.map((r) => r.usage.output)), higherIsBetter: false },
  rounds: { label: "Edit rounds per run", of: (rs) => mean(rs.map((r) => r.editRounds)), higherIsBetter: false },
  wall: { label: "Wall time per run (s)", of: (rs) => mean(rs.map((r) => r.wallMs / 1000)), higherIsBetter: false },
  dollars: { label: "Dollars per run", of: (rs) => (rs.some((r) => r.dollars === null) ? null : mean(rs.map((r) => r.dollars ?? 0))), higherIsBetter: false },
};

/** metric value per task for one model and arm */
export function perTask(recs: Rec[], model: string, arm: Arm, metric: string, keep: (t: string) => boolean): Map<string, number> {
  const m = METRICS[metric];
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    if (r.model !== model || r.arm !== arm || !keep(r.task) || infrastructureFailure(r)) continue;
    if (m.tasks && !m.tasks(r.task, r.kind)) continue;
    if (!groups.has(r.task)) groups.set(r.task, []);
    groups.get(r.task)!.push(r);
  }
  const out = new Map<string, number>();
  for (const [t, rs] of groups) {
    const v = m.of(rs);
    if (v !== null && !Number.isNaN(v)) out.set(t, v);
  }
  return out;
}

/** Paired per-task differences a − b over the tasks both have. */
export function paired(a: Map<string, number>, b: Map<string, number>): number[] {
  return [...a.keys()].filter((t) => b.has(t)).sort().map((t) => a.get(t)! - b.get(t)!);
}

// ---------------------------------------------------------------- the report

const pct = (x: number) => (Number.isNaN(x) ? "–" : `${(100 * x).toFixed(1)}%`);
const num = (x: number, d = 1) => (Number.isNaN(x) ? "–" : x.toFixed(d));
const fmt = (metric: string, e: Estimate, signed = false) => {
  const proportion = !["tokens", "outputTokens", "rounds", "wall", "dollars"].includes(metric);
  const f = (x: number) => (proportion ? `${signed && x > 0 ? "+" : ""}${(100 * x).toFixed(1)}${signed ? " pp" : "%"}` : `${signed && x > 0 ? "+" : ""}${num(x, metric === "dollars" ? 3 : metric === "rounds" ? 2 : 0)}`);
  return Number.isNaN(e.mean) ? "–" : `${f(e.mean)} [${f(e.lo)}, ${f(e.hi)}]`;
};

export interface Analysis {
  markdown: string;
  summary: Record<string, unknown>;
}

export function analyze(recs: Rec[], config: Config, label: string): Analysis {
  const adapted = adaptedTasks();
  const models = [...new Set(recs.map((r) => r.model))].sort();
  const lines: string[] = [];
  const summary: Record<string, unknown> = { label, models: {} as Record<string, unknown> };
  const infra = recs.filter(infrastructureFailure).length;
  lines.push(`Records: ${recs.length} runs (${infra} infrastructure failures excluded), ${new Set(recs.map((r) => r.task)).size} tasks, models ${models.join(", ")}.`);
  for (const subset of [{ name: "All tasks", keep: (_t: string) => true }, { name: "Without adapted tasks", keep: (t: string) => !adapted.has(t) }]) {
    lines.push("", `## ${label}: ${subset.name}`);
    const winRule: Record<string, boolean> = {};
    for (const model of models) {
      const base = config.baseline[model] ?? "openapi";
      const ms: Record<string, unknown> = {};
      lines.push("", `### ${model} (baseline: ${base})`, "");
      lines.push(`| Metric | direct | openapi | canon | canon − ${base} |`, "| --- | --- | --- | --- | --- |");
      for (const metric of Object.keys(METRICS)) {
        const per = Object.fromEntries(ARMS.map((a) => [a, perTask(recs, model, a, metric, subset.keep)])) as Record<Arm, Map<string, number>>;
        const est = Object.fromEntries(ARMS.map((a) => [a, bootstrap([...per[a].values()])])) as Record<Arm, Estimate>;
        const diff = bootstrap(paired(per.canon, per[base]));
        ms[metric] = { ...est, diff };
        lines.push(`| ${METRICS[metric].label} | ${fmt(metric, est.direct)} | ${fmt(metric, est.openapi)} | ${fmt(metric, est.canon)} | ${fmt(metric, diff, true)} |`);
      }
      const prim = (ms.pass as { diff: Estimate }).diff;
      const primary = outcome(prim, config.margin);
      const changeDiff = (ms.change as { diff: Estimate }).diff;
      const mismatchDiff = (ms.mismatch as { diff: Estimate }).diff;
      const changeBetter = changeDiff.lo > 0;
      const mismatchBetter = mismatchDiff.hi < 0;
      const qwenExploratory = ARMS.every((a) => {
        const v = [...perTask(recs, model, a, "pass", subset.keep).values()];
        return mean(v) < 0.1;
      });
      lines.push("",
        `Primary (end-to-end pass, canon − ${base}, margin ${pct(config.margin)}): **${primary}** (${fmt("pass", prim, true)}, ${prim.n} tasks).`,
        `Change-task success better: ${changeBetter ? "yes" : "no"} (${fmt("change", changeDiff, true)}). Mismatch rate lower: ${mismatchBetter ? "yes" : "no"} (${fmt("mismatch", mismatchDiff, true)}).` +
        (qwenExploratory ? " Every arm passes under 10%: this model is reported as exploratory." : ""));
      if (config.frontier.includes(model)) winRule[model] = (primary === "win" || primary === "non-inferior") && (changeBetter || mismatchBetter);
      (summary.models as Record<string, unknown>)[`${model}|${subset.name}`] = { baseline: base, primary, prim, changeDiff, mismatchDiff, exploratory: qwenExploratory, metrics: ms };
    }
    const all = config.frontier.every((m) => winRule[m]);
    lines.push("", `**Win rule (${subset.name.toLowerCase()}):** ${config.frontier.map((m) => `${m} ${winRule[m] ? "met" : "not met"}`).join("; ")}. ` +
      `"Canon is the better full-stack language for agents" is ${all ? "**supported**" : "**not supported**"}.`);
    summary[`winRule|${subset.name}`] = { perModel: winRule, supported: all };
  }
  return { markdown: lines.join("\n"), summary };
}

// ---------------------------------------------------------------- CLI

if (process.argv[1]?.endsWith("analyze.ts")) {
  const arg = (n: string, d?: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i >= 0 ? process.argv[i + 1] : d;
  };
  const config = JSON.parse(readFileSync(join(FS1, arg("config", "analysis/config.json")!), "utf8")) as Config;
  const recs = load(arg("results", "results/main-*.jsonl")!.split(","));
  const a = analyze(recs, config, arg("label", "FS-1")!);
  console.log(a.markdown);
  const j = arg("json");
  if (j) writeFileSync(join(FS1, j), JSON.stringify(a.summary, null, 2) + "\n");
}
