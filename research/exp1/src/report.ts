/**
 * Experiment 1 analysis: pass rate and silent-failure rate by model and setup, with 95% bootstrap
 * intervals (tasks resampled with replacement, 10,000 times, seed 2026), plus the chart: pass rate
 * by model size, one line per setup. Pre-registered comparisons are applied by `--prereg` once
 * PREREGISTRATION.md exists; without it this prints the descriptive table (used for the pilot).
 *
 *   npx tsx --conditions=source src/report.ts --in pilot.jsonl
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Exp1Record } from "./run.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv.includes("--in") ? process.argv[process.argv.indexOf("--in") + 1] : "runs.jsonl";
const runs: Exp1Record[] = readFileSync(join(HERE, "..", "results", file), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

/** model order on the chart's x axis: smallest to largest */
export const MODEL_ORDER = [
  "Qwen2.5-Coder-1.5B-Instruct-8bit",
  "Qwen2.5-Coder-7B-Instruct-8bit",
  "Qwen2.5-Coder-14B-Instruct-8bit",
  "claude-haiku-5-5",
  "claude-opus-5-5",
];
export const SETUP_ORDER = ["py-plain", "py-patch", "ts-plain", "ts-patch", "canon"];
const SETUP_LABEL: Record<string, string> = { "py-plain": "Python, plain errors", "py-patch": "Python, errors with patches", "ts-plain": "TypeScript, plain errors", "ts-patch": "TypeScript, errors with patches", canon: "Canon" };
const SHORT: Record<string, string> = {
  "Qwen2.5-Coder-1.5B-Instruct-8bit": "Qwen 1.5B",
  "Qwen2.5-Coder-7B-Instruct-8bit": "Qwen 7B",
  "Qwen2.5-Coder-14B-Instruct-8bit": "Qwen 14B",
  "claude-haiku-5-5": "Haiku 5.5",
  "claude-opus-5-5": "Opus 5.5",
};

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

/** rate of `f` over runs grouped by task, with a 95% bootstrap interval over tasks */
export function rateCI(rs: Exp1Record[], f: (r: Exp1Record) => boolean): [number, number, number] {
  const byTask = new Map<string, Exp1Record[]>();
  for (const r of rs) (byTask.get(r.task) ?? byTask.set(r.task, []).get(r.task)!).push(r);
  const tasks = [...byTask.keys()].sort();
  const stat = (ts: string[]) => {
    const all = ts.flatMap((t) => byTask.get(t)!);
    return all.filter(f).length / all.length;
  };
  const r = rng(2026);
  const xs: number[] = [];
  for (let i = 0; i < 10000; i++) xs.push(stat(tasks.map(() => tasks[Math.floor(r() * tasks.length)])));
  xs.sort((a, b) => a - b);
  return [stat(tasks), xs[249], xs[9749]];
}

/** paired difference in rates (setup a minus setup b) over shared tasks, with a 95% interval */
export function diffCI(a: Exp1Record[], b: Exp1Record[], f: (r: Exp1Record) => boolean): [number, number, number] {
  const group = (rs: Exp1Record[]) => {
    const m = new Map<string, Exp1Record[]>();
    for (const r of rs) (m.get(r.task) ?? m.set(r.task, []).get(r.task)!).push(r);
    return m;
  };
  const ga = group(a);
  const gb = group(b);
  const tasks = [...ga.keys()].filter((t) => gb.has(t)).sort();
  const rate = (g: Map<string, Exp1Record[]>, ts: string[]) => {
    const all = ts.flatMap((t) => g.get(t)!);
    return all.filter(f).length / all.length;
  };
  const stat = (ts: string[]) => rate(ga, ts) - rate(gb, ts);
  const r = rng(2026);
  const xs: number[] = [];
  for (let i = 0; i < 10000; i++) xs.push(stat(tasks.map(() => tasks[Math.floor(r() * tasks.length)])));
  xs.sort((x, y) => x - y);
  return [stat(tasks), xs[249], xs[9749]];
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const ci = ([p, lo, hi]: [number, number, number], f = pct) => `${f(p)} [${f(lo)}, ${f(hi)}]`;
const pass = (r: Exp1Record) => r.pass;
const silent = (r: Exp1Record) => r.silent;

const models = MODEL_ORDER.filter((m) => runs.some((r) => r.model === m)).concat([...new Set(runs.map((r) => r.model))].filter((m) => !MODEL_ORDER.includes(m)));
const setups = SETUP_ORDER.filter((s) => runs.some((r) => r.setup === s));
const sel = (m: string, s: string) => runs.filter((r) => r.model === m && r.setup === s);

const lines = [
  `# Experiment 1 results (${file})`,
  "",
  `${runs.length} runs. Rates are over runs; intervals are 95% bootstrap intervals over tasks.`,
  "",
  "| Model | Setup | Runs | Pass [95% CI] | Silent failures [95% CI] | First-try valid | Never checked clean |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
];
for (const m of models) {
  for (const s of setups) {
    const rs = sel(m, s);
    if (!rs.length) continue;
    lines.push(
      `| ${m} | ${s} | ${rs.length} | ${ci(rateCI(rs, pass))} | ${ci(rateCI(rs, silent))} | ${pct(rs.filter((r) => r.firstPassOk).length / rs.length)} | ${pct(rs.filter((r) => !r.finalOk).length / rs.length)} |`,
    );
  }
}
lines.push("", "## Paired differences in pass rate", "", "| Model | Canon - Python | Canon - TS plain | Canon - TS patch | TS patch - TS plain |", "| --- | ---: | ---: | ---: | ---: |");
for (const m of models) {
  const [c, p, t, py] = ["canon", "ts-patch", "ts-plain", "py-plain"].map((s) => sel(m, s));
  if (!c.length || !p.length || !t.length) continue;
  const pp = (x: number) => `${(100 * x).toFixed(1)} pts`;
  lines.push(`| ${m} | ${py.length ? ci(diffCI(c, py, pass), pp) : "-"} | ${ci(diffCI(c, t, pass), pp)} | ${ci(diffCI(c, p, pass), pp)} | ${ci(diffCI(p, t, pass), pp)} |`);
}
const outName = file.replace(/\.jsonl$/, "");
mkdirSync(join(HERE, ".."), { recursive: true });
writeFileSync(join(HERE, "..", `REPORT-${outName}.md`), lines.join("\n") + "\n");

// chart: pass rate by model size, one line per setup, 95% interval whiskers
const W = 760;
const H = 420;
const L = 70;
const R = 200;
const T = 30;
const B = 60;
const xs = (i: number) => L + ((W - L - R) * (models.length === 1 ? 0.5 : i / (models.length - 1)));
const ys = (v: number) => T + (H - T - B) * (1 - v);
const COLORS: Record<string, string> = { "py-plain": "#d97706", "py-patch": "#92400e", "ts-plain": "#9ca3af", "ts-patch": "#6b7280", canon: "#2563eb" };
const DASH: Record<string, string> = { "py-plain": "2 3", "py-patch": "", "ts-plain": "4 4", "ts-patch": "", canon: "" };
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`,
  `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ...[0, 0.25, 0.5, 0.75, 1].map(
    (v) => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" stroke="#e5e7eb"/><text x="${L - 10}" y="${ys(v) + 4}" font-size="12" text-anchor="end" fill="#6b7280">${Math.round(v * 100)}%</text>`,
  ),
  ...models.map((m, i) => `<text x="${xs(i)}" y="${H - B + 22}" font-size="12" text-anchor="middle" fill="#374151">${SHORT[m] ?? m}</text>`),
  `<text x="${(L + W - R) / 2}" y="${H - 12}" font-size="13" text-anchor="middle" fill="#374151">Model (smallest to largest)</text>`,
  `<text x="16" y="${(T + H - B) / 2}" font-size="13" text-anchor="middle" fill="#374151" transform="rotate(-90 16 ${(T + H - B) / 2})">Pass rate on hidden tests</text>`,
];
setups.forEach((s, si) => {
  const pts = models.map((m, i) => ({ i, v: sel(m, s).length ? rateCI(sel(m, s), pass) : null })).filter((p) => p.v);
  const off = (si - (setups.length - 1) / 2) * 6;
  parts.push(`<polyline fill="none" stroke="${COLORS[s]}" stroke-width="2.5" ${DASH[s] ? `stroke-dasharray="${DASH[s]}"` : ""} points="${pts.map((p) => `${xs(p.i) + off},${ys(p.v![0])}`).join(" ")}"/>`);
  for (const p of pts) {
    const [v, lo, hi] = p.v!;
    parts.push(
      `<line x1="${xs(p.i) + off}" x2="${xs(p.i) + off}" y1="${ys(lo)}" y2="${ys(hi)}" stroke="${COLORS[s]}" stroke-width="1.5"/>`,
      `<circle cx="${xs(p.i) + off}" cy="${ys(v)}" r="4.5" fill="${COLORS[s]}"/>`,
    );
  }
  parts.push(`<line x1="${W - R + 20}" x2="${W - R + 44}" y1="${T + 10 + si * 22}" y2="${T + 10 + si * 22}" stroke="${COLORS[s]}" stroke-width="2.5" ${DASH[s] ? `stroke-dasharray="${DASH[s]}"` : ""}/><text x="${W - R + 50}" y="${T + 14 + si * 22}" font-size="12" fill="#374151">${SETUP_LABEL[s]}</text>`);
});
parts.push("</svg>");
writeFileSync(join(HERE, "..", `chart-${outName}.svg`), parts.join("\n"));
console.log(lines.join("\n"));
