/**
 * The benchmark numbers the site shows, computed from research/benchmark/results/runs.jsonl with
 * the same rules as research/benchmark/src/report.ts (PREREGISTRATION.md). A test checks that the
 * verdicts here match the ones in research/benchmark/REPORT.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TASKS } from "../../research/benchmark/src/tasks.js";

interface Run {
  model: string;
  fallback: boolean;
  lang: string;
  task: string;
  firstPassOk: boolean;
  fixRounds: number;
  finalOk: boolean;
  firstCodes: string[];
  normalized: string;
  tests: { passed: number; total: number };
  usage: { input: number; cachedInput: number; cacheWrite: number; output: number };
  cost: number | null;
  ms: number;
}

type Lang = "canon" | "typescript";
const LANGS: Lang[] = ["canon", "typescript"];

export interface Arm {
  runs: number;
  correct: number;
  correctHard: number;
  firstPass: number;
  /** mean distinct programs per task, with a 95% bootstrap interval over tasks */
  distinct: number;
  distinctLo: number;
  distinctHi: number;
  turns: number;
  tokensPerCorrect: number;
  seconds: number;
  cost: number | null;
  /** dollars per correct program (null without a price) and mean output tokens per run */
  costPerCorrect: number | null;
  outputTokens: number;
}

export interface ModelResult {
  model: string;
  canon: Arm;
  typescript: Arm;
  /** Canon distinct / TypeScript distinct, with the pre-registered 95% interval */
  ratio: number;
  ratioLo: number;
  ratioHi: number;
  /** Canon / TypeScript */
  tokenMultiple: number;
  timeMultiple: number;
  /** Canon first drafts that failed, and how many of those passed after exactly one fix round */
  failedFirst: number;
  fixedInOne: number;
  /** extra input tokens per first request in Canon (the reference): median over tasks, one-turn runs */
  promptOverhead: number;
}

export type VerdictLabel = "SUPPORTED" | "NOT SUPPORTED" | "NOT TESTED";
export interface Verdict {
  id: string;
  name: string;
  verdict: VerdictLabel;
  perModel: { model: string; pass: boolean | null; detail: string }[];
}

export interface TaskRow {
  task: string;
  tier: "basic" | "hard";
  distinct: Record<string, { canon: number; typescript: number }>;
}

export interface Benchmark {
  /** which run: the results file and the report it was judged in */
  file: string;
  report: string;
  runs: number;
  canonRuns: number;
  tasks: number;
  hardTasks: number;
  runsPerTask: number;
  models: string[];
  byModel: ModelResult[];
  /** the verdicts as the report states them (all criteria of that pre-registration) */
  verdicts: Verdict[];
  /** C1 to C4 recomputed here; a test checks they agree with the report */
  computedVerdicts: Verdict[];
  taskRows: TaskRow[];
}

/** Read the Verdicts table that report.ts / report-v02.ts wrote. */
export function parseVerdicts(md: string, models: string[]): Verdict[] {
  const out: Verdict[] = [];
  for (const line of md.split("\n")) {
    const m = /^\| (C\d+s?|D\d+s?) \| (.+) \|$/.exec(line);
    if (!m) continue;
    const cells = m[2].split(" | ");
    const verdictCell = cells.pop()!;
    const name = cells.shift()!.replace(/\s*\(.*\)\s*$/, "").trim();
    const verdict = (/\*\*(SUPPORTED|NOT SUPPORTED|NOT TESTED)\*\*/.exec(verdictCell)?.[1] ?? "NOT TESTED") as VerdictLabel;
    out.push({
      id: m[1],
      name,
      verdict,
      perModel: cells.map((c, i) => ({
        model: models[i],
        pass: c.startsWith("✅") ? true : c.startsWith("❌") ? false : null,
        detail: c.replace(/^(✅|❌)\s*/, ""),
      })),
    });
  }
  if (!out.length) throw new Error("no verdicts found in the report");
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const correct = (r: Run) => r.finalOk && r.tests.passed === r.tests.total;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

/** mulberry32, as in report.ts, so the intervals match */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boot(tasks: string[], stat: (picked: string[]) => number): [number, number, number] {
  const r = rng(2026);
  const xs: number[] = [];
  for (let i = 0; i < 10000; i++) xs.push(stat(tasks.map(() => tasks[Math.floor(r() * tasks.length)])));
  xs.sort((a, b) => a - b);
  return [stat(tasks), xs[249], xs[9749]];
}

function distinctByTask(rs: Run[]): Map<string, number> {
  const m = new Map<string, Set<string>>();
  for (const r of rs) (m.get(r.task) ?? m.set(r.task, new Set()).get(r.task)!).add(r.normalized);
  return new Map([...m].map(([k, v]) => [k, v.size]));
}

export function loadBenchmark(root: string, file: string, report: string): Benchmark {
  // the bootstrap resamples tasks in the order its report script used: sorted ids (report.ts) or TASKS order (report-v02.ts)
  const specOrder = report !== "REPORT.md";
  const order = (ids: string[]) => (specOrder ? TASKS.map((t) => t.id).filter((id) => ids.includes(id)) : [...ids].sort());
  const all: Run[] = readFileSync(join(root, "research", "benchmark", "results", file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const used = all.filter((r) => !r.fallback);
  const models = [...new Set(used.map((r) => r.model))].sort();
  const hardIds = new Set(TASKS.filter((t) => t.tier === "hard").map((t) => t.id));

  const distinctMaps: Record<string, Record<Lang, Map<string, number>>> = {};
  const arm = (model: string, lang: Lang): Arm => {
    const rs = used.filter((r) => r.model === model && r.lang === lang);
    const hard = rs.filter((r) => hardIds.has(r.task));
    const ok = rs.filter(correct);
    const tokens = rs.reduce((a, r) => a + r.usage.input + r.usage.cachedInput + r.usage.cacheWrite + r.usage.output, 0);
    const d = distinctByTask(rs);
    (distinctMaps[model] ??= {} as Record<Lang, Map<string, number>>)[lang] = d;
    const ids = order([...d.keys()]);
    const [distinct, distinctLo, distinctHi] = boot(ids, (p) => mean(p.map((t) => d.get(t)!)));
    return {
      runs: rs.length,
      correct: ok.length / rs.length,
      correctHard: hard.filter(correct).length / hard.length,
      firstPass: rs.filter((r) => r.firstPassOk).length / rs.length,
      distinct,
      distinctLo,
      distinctHi,
      turns: mean(ok.map((r) => 1 + r.fixRounds)),
      tokensPerCorrect: ok.length ? tokens / ok.length : NaN,
      seconds: mean(rs.map((r) => r.ms / 1000)),
      cost: rs.every((r) => r.cost !== null) ? rs.reduce((a, r) => a + (r.cost ?? 0), 0) : null,
      costPerCorrect: rs.every((r) => r.cost !== null) && ok.length ? rs.reduce((a, r) => a + (r.cost ?? 0), 0) / ok.length : null,
      outputTokens: mean(rs.map((r) => r.usage.output)),
    };
  };

  const byModel: ModelResult[] = models.map((model) => {
    const canon = arm(model, "canon");
    const typescript = arm(model, "typescript");
    const c = distinctMaps[model].canon;
    const t = distinctMaps[model].typescript;
    const shared = order([...c.keys()].filter((k) => t.has(k)));
    const [ratio, ratioLo, ratioHi] = boot(shared, (p) => mean(p.map((k) => c.get(k)!)) / mean(p.map((k) => t.get(k)!)));
    const canonRuns = used.filter((r) => r.model === model && r.lang === "canon");
    const failed = canonRuns.filter((r) => !r.firstPassOk);
    const firstInput = (lang: Lang, task: string) =>
      median(
        used
          .filter((r) => r.model === model && r.lang === lang && r.task === task && r.fixRounds === 0)
          .map((r) => r.usage.input + r.usage.cachedInput + r.usage.cacheWrite),
      );
    const promptOverhead = median(TASKS.map((tk) => firstInput("canon", tk.id) - firstInput("typescript", tk.id)).filter((x) => !Number.isNaN(x)));
    return {
      model,
      promptOverhead,
      canon,
      typescript,
      ratio,
      ratioLo,
      ratioHi,
      tokenMultiple: canon.tokensPerCorrect / typescript.tokensPerCorrect,
      timeMultiple: canon.seconds / typescript.seconds,
      failedFirst: failed.length,
      fixedInOne: failed.filter((r) => correct(r) && r.fixRounds === 1).length,
    };
  });

  // the pre-registered criteria, exactly as report.ts applies them
  const criteria: { id: string; name: string; perModel: (m: ModelResult) => { pass: boolean; detail: string } }[] = [
    {
      id: "C1",
      name: "Understood from the reference alone",
      perModel: (m) => ({ pass: m.canon.correct >= m.typescript.correct - 0.05, detail: `Canon ${pct(m.canon.correct)} vs TypeScript ${pct(m.typescript.correct)} correct` }),
    },
    {
      id: "C2",
      name: "Coded right",
      perModel: (m) => ({ pass: m.canon.correct >= 0.9 && m.canon.correctHard >= 0.8, detail: `${pct(m.canon.correct)} correct overall, ${pct(m.canon.correctHard)} on hard tasks` }),
    },
    {
      id: "C3",
      name: "One way to write it",
      perModel: (m) => ({
        pass: m.ratio <= 0.5 && m.ratioHi < 1,
        detail: `${m.canon.distinct.toFixed(2)} vs ${m.typescript.distinct.toFixed(2)} distinct programs per task; ratio ${m.ratio.toFixed(2)} (95% CI ${m.ratioLo.toFixed(2)} to ${m.ratioHi.toFixed(2)})`,
      }),
    },
    {
      id: "C4",
      name: "At least as fast for an agent",
      perModel: (m) => ({ pass: m.canon.turns <= m.typescript.turns + 0.25, detail: `${m.canon.turns.toFixed(2)} vs ${m.typescript.turns.toFixed(2)} tries to working code` }),
    },
  ];
  const computedVerdicts: Verdict[] = criteria.map((c) => {
    const per = byModel.map((m) => ({ model: m.model, ...c.perModel(m) }));
    return { id: c.id, name: c.name, verdict: per.every((p) => p.pass) ? "SUPPORTED" : "NOT SUPPORTED", perModel: per };
  });
  const verdicts = parseVerdicts(readFileSync(join(root, "research", "benchmark", report), "utf8"), models);

  const taskRows: TaskRow[] = TASKS.map((t) => ({
    task: t.id,
    tier: t.tier,
    distinct: Object.fromEntries(
      models.map((m) => [m, { canon: distinctMaps[m].canon.get(t.id) ?? 0, typescript: distinctMaps[m].typescript.get(t.id) ?? 0 }]),
    ),
  }));

  const runsPerTask = used.length / (TASKS.length * models.length * LANGS.length);
  return {
    file,
    report,
    runs: used.length,
    canonRuns: used.filter((r) => r.lang === "canon").length,
    tasks: TASKS.length,
    hardTasks: hardIds.size,
    runsPerTask,
    models,
    byModel,
    verdicts,
    computedVerdicts,
    taskRows,
  };
}
