/**
 * Apply PREREGISTRATION-v0.2.md to results/runs-v0.2.jsonl (with results/runs.jsonl as the v0
 * baseline). Writes REPORT-v0.2.md and benchmark-v0.2.svg. Deterministic:
 * every bootstrap uses its own generator seeded with 2026.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunRecord } from "./run.js";
import { structural } from "./structure.js";
import { TASKS, type Task } from "./tasks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f: string): RunRecord[] =>
  readFileSync(f.startsWith("/") ? f : join(HERE, "..", "results", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const argIn = process.argv.includes("--in") ? process.argv[process.argv.indexOf("--in") + 1] : "runs-v0.2.jsonl";

const v02all = load(argIn);
const v02 = v02all.filter((r) => !r.fallback);
const v0 = load("runs.jsonl").filter((r) => !r.fallback);
const MODELS = [...new Set(v02.map((r) => r.model))].sort();
const taskById = new Map(TASKS.map((t) => [t.id, t]));
const hardIds = new Set(TASKS.filter((t) => t.tier === "hard").map((t) => t.id));
const correct = (r: RunRecord) => r.finalOk && r.tests.passed === r.tests.total;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

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

/** point estimate and 95% interval of stat(tasks), resampling tasks with replacement */
function boot(tasks: string[], stat: (ts: string[]) => number): [number, number, number] {
  const r = rng(2026);
  const xs: number[] = [];
  for (let i = 0; i < 10000; i++) xs.push(stat(tasks.map(() => tasks[Math.floor(r() * tasks.length)])));
  xs.sort((a, b) => a - b);
  return [stat(tasks), xs[249], xs[9749]];
}

type Lang = "canon" | "typescript";
const byTask = (rs: RunRecord[], model: string, lang: Lang) => {
  const m = new Map<string, RunRecord[]>();
  for (const r of rs) if (r.model === model && r.lang === lang) (m.get(r.task) ?? m.set(r.task, []).get(r.task)!).push(r);
  return m;
};
const distinctCache = new WeakMap<RunRecord[], [number, number]>();
/** distinct programs among one task's runs (raw, structural), computed once per run list */
const distinct = (runs: RunRecord[], lang: Lang, t: Task, structuralMetric: boolean) => {
  let d = distinctCache.get(runs);
  if (!d) {
    d = [new Set(runs.map((r) => r.normalized)).size, new Set(runs.map((r) => structural(r.normalized, lang, t))).size];
    distinctCache.set(runs, d);
  }
  return structuralMetric ? d[1] : d[0];
};

interface Arm {
  runs: Map<string, RunRecord[]>;
  lang: Lang;
}
const arm = (rs: RunRecord[], m: string, lang: Lang): Arm => ({ runs: byTask(rs, m, lang), lang });
const tasksOf = (...arms: Arm[]) => TASKS.map((t) => t.id).filter((id) => arms.every((a) => a.runs.has(id)));

const rate = (a: Arm, ids: string[], f: (r: RunRecord) => boolean) => {
  const rs = ids.flatMap((id) => a.runs.get(id)!);
  return rs.filter(f).length / rs.length;
};
const meanDistinct = (a: Arm, ids: string[], s: boolean) => mean(ids.map((id) => distinct(a.runs.get(id)!, a.lang, taskById.get(id)!, s)));
const turns = (a: Arm, ids: string[]) => mean(ids.flatMap((id) => a.runs.get(id)!.filter(correct).map((r) => 1 + r.fixRounds)));
const dollarsPerCorrect = (a: Arm, ids: string[]) => {
  const rs = ids.flatMap((id) => a.runs.get(id)!);
  if (rs.some((r) => r.cost === null)) return NaN;
  return rs.reduce((s, r) => s + (r.cost ?? 0), 0) / rs.filter(correct).length;
};

type Verdict = { pass: boolean; detail: string };
const fmtCI = ([p, lo, hi]: [number, number, number], f: (x: number) => string) => `${f(p)} [${f(lo)}, ${f(hi)}]`;
const n2 = (x: number) => x.toFixed(2);

const results: Record<string, Record<string, Verdict>> = {};
const metricRows: string[] = [];
const chart: { model: string; series: { label: string; v: [number, number, number]; color: string }[] }[] = [];

for (const m of MODELS) {
  const C = arm(v02, m, "canon");
  const T = arm(v02, m, "typescript");
  const C0 = arm(v0, m, "canon");
  const ids = tasksOf(C, T);
  const hard = ids.filter((id) => hardIds.has(id));
  const paired = tasksOf(C, C0);
  const ratio = (a: Arm, b: Arm, s: boolean, ts: string[]) => boot(ts, (x) => meanDistinct(a, x, s) / meanDistinct(b, x, s));
  const cCorrect = rate(C, ids, correct);
  const tCorrect = rate(T, ids, correct);
  const r3 = ratio(C, T, false, ids);
  const r3s = ratio(C, T, true, ids);
  const d1 = ratio(C, C0, false, paired);
  const d1s = ratio(C, C0, true, paired);
  const cTurns = turns(C, ids);
  const tTurns = turns(T, ids);
  const cDollar = dollarsPerCorrect(C, ids);
  const tDollar = dollarsPerCorrect(T, ids);
  results[m] = {
    C1: { pass: cCorrect >= tCorrect - 0.05, detail: `Canon ${fmtCI(boot(ids, (x) => rate(C, x, correct)), pct)} vs TS ${pct(tCorrect)}` },
    C2: { pass: cCorrect >= 0.9 && rate(C, hard, correct) >= 0.8, detail: `overall ${pct(cCorrect)}, hard ${pct(rate(C, hard, correct))}` },
    C3: { pass: r3[0] <= 0.5 && r3[2] < 1, detail: `${n2(meanDistinct(C, ids, false))} vs ${n2(meanDistinct(T, ids, false))}; ratio ${fmtCI(r3, n2)}` },
    C3s: { pass: r3s[0] <= 0.5 && r3s[2] < 1, detail: `${n2(meanDistinct(C, ids, true))} vs ${n2(meanDistinct(T, ids, true))}; ratio ${fmtCI(r3s, n2)}` },
    C4: { pass: cTurns <= tTurns + 0.25, detail: `${n2(cTurns)} vs ${n2(tTurns)} turns` },
    C6: Number.isNaN(cDollar)
      ? { pass: true, detail: "n/a (no price)" }
      : { pass: cDollar <= 1.5 * tDollar, detail: `$${cDollar.toFixed(4)} vs $${tDollar.toFixed(4)} (${(cDollar / tDollar).toFixed(2)}x)` },
    D1: { pass: d1[2] < 1, detail: `v0.2 ${n2(meanDistinct(C, paired, false))} vs v0 ${n2(meanDistinct(C0, paired, false))}; ratio ${fmtCI(d1, n2)}` },
    D1s: { pass: d1s[2] < 1, detail: `v0.2 ${n2(meanDistinct(C, paired, true))} vs v0 ${n2(meanDistinct(C0, paired, true))}; ratio ${fmtCI(d1s, n2)}` },
  };
  for (const [label, a, tsIds] of [["Canon v0.2", C, ids], ["TypeScript", T, ids], ["Canon v0", C0, paired]] as const) {
    const all = tsIds.flatMap((id) => a.runs.get(id)!);
    metricRows.push(
      `| ${m} | ${label} | ${all.length} | ${pct(rate(a, [...tsIds], correct))} | ${pct(rate(a, [...tsIds], (r) => r.firstPassOk))} | ` +
        `${fmtCI(boot([...tsIds], (x) => meanDistinct(a, x, false)), n2)} | ${fmtCI(boot([...tsIds], (x) => meanDistinct(a, x, true)), n2)} | ` +
        `${n2(turns(a, [...tsIds]))} | ${Number.isNaN(dollarsPerCorrect(a, [...tsIds])) ? "n/a" : `$${dollarsPerCorrect(a, [...tsIds]).toFixed(4)}`} |`,
    );
  }
  chart.push({
    model: m,
    series: [
      { label: "Canon v0", v: boot(paired, (x) => meanDistinct(C0, x, false)), color: "#93c5fd" },
      { label: "Canon v0.2", v: boot(ids, (x) => meanDistinct(C, x, false)), color: "#2563eb" },
      { label: "TypeScript", v: boot(ids, (x) => meanDistinct(T, x, false)), color: "#9ca3af" },
    ],
  });
}

const CRITERIA: [string, string][] = [
  ["C1", "Understood from the reference alone"],
  ["C2", "Coded right (90% overall, 80% hard)"],
  ["C3", "One way to write it: distinct programs <= 50% of TypeScript (primary)"],
  ["C3s", "... structurally (secondary)"],
  ["C4", "At least as fast for an agent (turns)"],
  ["C6", "Affordable: Claude $ per correct program <= 1.5x TypeScript"],
  ["D1", "v0.2 improved convergence over v0"],
  ["D1s", "... structurally"],
];
const lines = [
  "# Benchmark report: Canon v0.2",
  "",
  "Generated by `src/report-v02.ts` from `results/runs-v0.2.jsonl` (baseline: `results/runs.jsonl`) under [PREREGISTRATION-v0.2.md](PREREGISTRATION-v0.2.md).",
  `${v02.length} runs used${v02all.length - v02.length ? `, ${v02all.length - v02.length} excluded (fallback)` : ""}. Intervals are 95% bootstrap intervals over tasks.`,
  "",
  "## Verdicts",
  "",
  `| # | Criterion | ${MODELS.join(" | ")} | Verdict |`,
  `| --- | --- | ${MODELS.map(() => "---").join(" | ")} | --- |`,
];
const supported: string[] = [];
for (const [id, name] of CRITERIA) {
  const per = MODELS.map((m) => results[m][id]);
  const relevant = id === "C6" ? per.filter((v) => !v.detail.startsWith("n/a")) : per;
  const pass = relevant.length > 0 && relevant.every((v) => v.pass);
  if (pass) supported.push(id);
  lines.push(`| ${id} | ${name} | ${per.map((v) => `${v.detail.startsWith("n/a") ? "" : v.pass ? "✅ " : "❌ "}${v.detail}`).join(" | ")} | **${pass ? "SUPPORTED" : "NOT SUPPORTED"}** |`);
}
lines.push(`| C5 | Programs run faster | ${MODELS.map(() => "n/a").join(" | ")} | **NOT TESTED** |`, "");
lines.push(`**Supported: ${supported.join(", ") || "none"}. Not supported: ${CRITERIA.map(([id]) => id).filter((id) => !supported.includes(id)).join(", ") || "none"}.** C5 is not tested.`);
lines.push(
  "",
  "## Metrics",
  "",
  "| Model | Arm | Runs | Correct | First-pass valid | Distinct / task [95% CI] | Structural distinct [95% CI] | Turns to correct | $ / correct |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...metricRows,
);
writeFileSync(join(HERE, "..", "REPORT-v0.2.md"), lines.join("\n") + "\n");

// chart with 95% interval whiskers
const W = 680;
const rowH = 30;
const H = 70 + chart.length * (3 * rowH + 40);
const max = Math.max(...chart.flatMap((c) => c.series.map((s) => s.v[2])), 1) * 1.05;
const X0 = 200;
const sx = (v: number) => X0 + ((W - X0 - 90) * v) / max;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`,
  `<rect width="100%" height="100%" fill="#ffffff"/>`,
  `<text x="16" y="28" font-size="15" font-weight="600" fill="#111">Distinct programs per task (lower = agents converge), with 95% intervals</text>`,
];
chart.forEach((c, i) => {
  const y0 = 56 + i * (3 * rowH + 40);
  parts.push(`<text x="16" y="${y0 + 14}" font-size="13" font-weight="600" fill="#333">${c.model}</text>`);
  c.series.forEach((s, j) => {
    const y = y0 + 22 + j * rowH;
    const [p, lo, hi] = s.v;
    parts.push(
      `<text x="${X0 - 10}" y="${y + 15}" font-size="12" text-anchor="end" fill="#333">${s.label}</text>`,
      `<rect x="${X0}" y="${y}" width="${(sx(p) - X0).toFixed(1)}" height="20" fill="${s.color}" rx="3"/>`,
      `<line x1="${sx(lo).toFixed(1)}" y1="${y + 10}" x2="${sx(hi).toFixed(1)}" y2="${y + 10}" stroke="#111" stroke-width="1.5"/>`,
      `<line x1="${sx(lo).toFixed(1)}" y1="${y + 5}" x2="${sx(lo).toFixed(1)}" y2="${y + 15}" stroke="#111" stroke-width="1.5"/>`,
      `<line x1="${sx(hi).toFixed(1)}" y1="${y + 5}" x2="${sx(hi).toFixed(1)}" y2="${y + 15}" stroke="#111" stroke-width="1.5"/>`,
      `<text x="${(sx(hi) + 8).toFixed(1)}" y="${y + 15}" font-size="12" fill="#333">${p.toFixed(2)}</text>`,
    );
  });
});
parts.push("</svg>");
writeFileSync(join(HERE, "..", "benchmark-v0.2.svg"), parts.join("\n"));
// the site draws its own charts from the raw runs (scripts/stats.ts, /research)
console.log(lines.slice(0, 22).join("\n"));
