/**
 * Apply PREREGISTRATION.md to results/runs.jsonl: write REPORT.md (metrics, criteria C1 to C5 with
 * verdicts) and benchmark.svg. Deterministic: bootstrap seed 2026.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RunRecord } from "./run.js";
import { TASKS } from "./tasks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv.includes("--in") ? process.argv[process.argv.indexOf("--in") + 1] : "runs.jsonl";
const runs: RunRecord[] = readFileSync(join(HERE, "..", "results", file), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const used = runs.filter((r) => !r.fallback);
const excluded = runs.length - used.length;

const MODELS = [...new Set(used.map((r) => r.model))].sort();
const LANGS = ["canon", "typescript"] as const;
const hardIds = new Set(TASKS.filter((t) => t.tier === "hard").map((t) => t.id));

const correct = (r: RunRecord) => r.finalOk && r.tests.passed === r.tests.total;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function select(model: string, lang: string, tier?: "hard") {
  return used.filter((r) => r.model === model && r.lang === lang && (!tier || hardIds.has(r.task)));
}

/** distinct normalized programs per task (only tasks with at least one run) */
function distinctByTask(rs: RunRecord[]): Map<string, number> {
  const m = new Map<string, Set<string>>();
  for (const r of rs) {
    if (!m.has(r.task)) m.set(r.task, new Set());
    m.get(r.task)!.add(r.normalized);
  }
  return new Map([...m].map(([k, v]) => [k, v.size]));
}

function metrics(model: string, lang: string) {
  const rs = select(model, lang);
  const hard = select(model, lang, "hard");
  const ok = rs.filter(correct);
  const tokens = rs.reduce((a, r) => a + r.usage.input + r.usage.cachedInput + r.usage.cacheWrite + r.usage.output, 0);
  const cost = rs.every((r) => r.cost !== null) ? rs.reduce((a, r) => a + (r.cost ?? 0), 0) : null;
  return {
    n: rs.length,
    correct: ok.length / rs.length,
    correctHard: hard.filter(correct).length / hard.length,
    firstPass: rs.filter((r) => r.firstPassOk).length / rs.length,
    distinct: distinctByTask(rs),
    turns: mean(ok.map((r) => 1 + r.fixRounds)),
    tokensPerCorrect: ok.length ? tokens / ok.length : NaN,
    seconds: mean(rs.map((r) => r.ms / 1000)),
    cost,
  };
}

/** mulberry32, for a reproducible bootstrap */
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

function ratioInterval(canon: Map<string, number>, ts: Map<string, number>): [number, number, number] {
  const tasks = [...canon.keys()].filter((k) => ts.has(k)).sort();
  const point = mean(tasks.map((t) => canon.get(t)!)) / mean(tasks.map((t) => ts.get(t)!));
  const r = rng(2026);
  const samples: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const pick = tasks.map(() => tasks[Math.floor(r() * tasks.length)]);
    samples.push(mean(pick.map((t) => canon.get(t)!)) / mean(pick.map((t) => ts.get(t)!)));
  }
  samples.sort((a, b) => a - b);
  return [point, samples[249], samples[9749]];
}

const M = Object.fromEntries(MODELS.map((m) => [m, { canon: metrics(m, "canon"), typescript: metrics(m, "typescript") }]));

type Verdict = { pass: boolean; detail: string };
const criteria: { id: string; name: string; perModel: (m: string) => Verdict }[] = [
  {
    id: "C1",
    name: "Understood from the reference alone (Correct, Canon >= TypeScript - 5 points)",
    perModel: (m) => {
      const c = M[m].canon.correct;
      const t = M[m].typescript.correct;
      return { pass: c >= t - 0.05, detail: `Canon ${pct(c)} vs TypeScript ${pct(t)}` };
    },
  },
  {
    id: "C2",
    name: "Coded right (Canon Correct >= 90% overall and >= 80% on hard tasks)",
    perModel: (m) => {
      const c = M[m].canon;
      return { pass: c.correct >= 0.9 && c.correctHard >= 0.8, detail: `overall ${pct(c.correct)}, hard ${pct(c.correctHard)}` };
    },
  },
  {
    id: "C3",
    name: "One way to write it (distinct programs: Canon <= 50% of TypeScript, 95% CI upper < 1)",
    perModel: (m) => {
      const [p, lo, hi] = ratioInterval(M[m].canon.distinct, M[m].typescript.distinct);
      const c = mean([...M[m].canon.distinct.values()]);
      const t = mean([...M[m].typescript.distinct.values()]);
      return { pass: p <= 0.5 && hi < 1, detail: `${c.toFixed(2)} vs ${t.toFixed(2)} per task; ratio ${p.toFixed(2)} (95% CI ${lo.toFixed(2)}-${hi.toFixed(2)})` };
    },
  },
  {
    id: "C4",
    name: "At least as fast for an agent (turns to correct: Canon <= TypeScript + 0.25)",
    perModel: (m) => {
      const c = M[m].canon.turns;
      const t = M[m].typescript.turns;
      return { pass: c <= t + 0.25, detail: `${c.toFixed(2)} vs ${t.toFixed(2)} turns` };
    },
  },
];

const lines: string[] = [
  "# Benchmark report",
  "",
  `Generated by \`src/report.ts\` from \`results/${file}\` under the rules in [PREREGISTRATION.md](PREREGISTRATION.md).`,
  `${used.length} runs used${excluded ? `, ${excluded} excluded (served by a refusal-fallback model)` : ""}.`,
  "",
  "## Verdicts",
  "",
  "| # | Criterion | " + MODELS.join(" | ") + " | Verdict |",
  "| --- | --- | " + MODELS.map(() => "---").join(" | ") + " | --- |",
];
const verdicts: Record<string, boolean> = {};
for (const c of criteria) {
  const per = MODELS.map((m) => c.perModel(m));
  const pass = per.every((v) => v.pass);
  verdicts[c.id] = pass;
  lines.push(`| ${c.id} | ${c.name} | ${per.map((v) => `${v.pass ? "✅" : "❌"} ${v.detail}`).join(" | ")} | **${pass ? "SUPPORTED" : "NOT SUPPORTED"}** |`);
}
lines.push(`| C5 | Programs run faster | ${MODELS.map(() => "n/a").join(" | ")} | **NOT TESTED** (v0 compiles to JavaScript) |`);
lines.push("");
const supported = criteria.filter((c) => verdicts[c.id]).map((c) => c.id);
lines.push(
  supported.length === criteria.length
    ? `**All of C1 to C4 are supported.** On this benchmark, with ${MODELS.join(" and ")}, agents coded Canon from its reference alone as correctly and as quickly as TypeScript, and wrote far fewer distinct programs per task. Scope: two models, ${TASKS.length} tasks. No runtime-speed claim (C5).`
    : `**Supported: ${supported.join(", ") || "none"}. Not supported: ${criteria.filter((c) => !verdicts[c.id]).map((c) => c.id).join(", ")}.** The claim narrows to the supported parts. No runtime-speed claim (C5).`,
);
lines.push("", "## Metrics", "", "| Model | Language | Runs | Correct | Correct (hard) | First-pass valid | Distinct / task | Turns to correct | Tokens / correct | Seconds / run | Cost |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const m of MODELS) {
  for (const l of LANGS) {
    const x = M[m][l];
    lines.push(`| ${m} | ${l} | ${x.n} | ${pct(x.correct)} | ${pct(x.correctHard)} | ${pct(x.firstPass)} | ${mean([...x.distinct.values()]).toFixed(2)} | ${x.turns.toFixed(2)} | ${Math.round(x.tokensPerCorrect).toLocaleString("en-US")} | ${x.seconds.toFixed(1)} | ${x.cost === null ? "n/a" : `$${x.cost.toFixed(2)}`} |`);
  }
}
lines.push("", "## Distinct programs per task", "", "| Task | Tier | " + MODELS.flatMap((m) => [`${m} Canon`, `${m} TS`]).join(" | ") + " |", "| --- | --- | " + MODELS.flatMap(() => ["---:", "---:"]).join(" | ") + " |");
for (const t of TASKS) {
  lines.push(`| ${t.id} | ${t.tier} | ` + MODELS.flatMap((m) => [M[m].canon.distinct.get(t.id) ?? "-", M[m].typescript.distinct.get(t.id) ?? "-"]).join(" | ") + " |");
}
writeFileSync(join(HERE, "..", "REPORT.md"), lines.join("\n") + "\n");

// chart: distinct programs per task, Canon vs TypeScript, per model
const W = 640;
const H = 80 + MODELS.length * 110;
const max = Math.max(...MODELS.flatMap((m) => LANGS.map((l) => mean([...M[m][l].distinct.values()]))), 1);
const bar = (x: number, y: number, v: number, color: string, label: string) => {
  const w = ((W - 260) * v) / max;
  return `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="26" fill="${color}" rx="3"/><text x="${x + w + 8}" y="${y + 18}" font-size="13">${v.toFixed(2)} ${label}</text>`;
};
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`,
  `<rect width="100%" height="100%" fill="#ffffff"/>`,
  `<text x="16" y="28" font-size="15" font-weight="600" fill="#111">Distinct programs per task (10 runs each; lower means agents converge)</text>`,
  ...MODELS.flatMap((m, i) => {
    const y = 60 + i * 110;
    return [
      `<text x="16" y="${y + 18}" font-size="13" fill="#333">${m}</text>`,
      bar(180, y, mean([...M[m].canon.distinct.values()]), "#2563eb", "Canon"),
      bar(180, y + 34, mean([...M[m].typescript.distinct.values()]), "#9ca3af", "TypeScript"),
    ];
  }),
  `</svg>`,
].join("\n");
writeFileSync(join(HERE, "..", "benchmark.svg"), svg);
// the site draws its own charts from the raw runs (scripts/stats.ts, /research)
console.log(lines.slice(0, 20).join("\n"));
