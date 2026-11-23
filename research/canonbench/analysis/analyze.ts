/**
 * CanonBench's pre-registered analysis (plan section 7). Reads raw runs (JSON lines in results/)
 * and writes results/scoreboard-<tag>.json and results/scoreboard-<tag>.md.
 *
 * Unit of analysis: the seed. A seed's score in an arm is the mean of its items' outcomes over all
 * runs (pass for WRITE, FIX, CHANGE and THINK; correct for READ). Seeds are paired across arms; only
 * seeds with at least one recorded run in both arms of a comparison enter it.
 * Per cell (family x model): d = Canon - baseline, where the baseline is the other language fixed in
 * PREREGISTRATION.md (chosen from the pilot). 95% interval: percentile bootstrap over seeds,
 * 10,000 resamples, fixed seed. One-sided p for "Canon better": the bootstrap share of resampled
 * mean differences <= 0 (with a +1 correction).
 *   win:          Holm-adjusted p < 0.025 across every cell of the scoreboard (excluding cost),
 *                 which for a single cell is the same as the interval lying above 0
 *   non-inferior: not a win, and the interval's lower end is above -m
 *   lose:         the whole interval is below -m
 *   inconclusive: anything else
 * Cost row: tokens per item (input + output, all rounds), Canon / baseline ratio, same bootstrap
 * on the per-seed log ratio; "lose" means Canon uses more tokens with the interval above 0.
 *
 *   npx tsx --conditions=source analysis/analyze.ts --tag main [--margin 0.10] [--baselines file]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "../lib/gen.js";

const HERE = new URL(".", import.meta.url).pathname;
const RESULTS = join(HERE, "..", "results");

export const MODELS = ["qwen7b", "opus", "gpt"];
export const MODEL_IDS: Record<string, string> = { qwen7b: "mlx-community/Qwen2.5-Coder-7B-Instruct-8bit", opus: "claude-opus-5-5", gpt: "gpt-6.2-sol" };
export const FAMILY_ROWS = ["READ", "READ-effects", "READ-property", "READ-output", "WRITE", "FIX", "CHANGE", "THINK"] as const;
export type Row = (typeof FAMILY_ROWS)[number];

export interface Rec {
  key: string;
  family: string;
  model: string;
  arm: string;
  item: string;
  seed: string;
  run: number;
  type?: string;
  pass?: boolean;
  correct?: boolean;
  accepted?: boolean;
  errorsReported?: number;
  errorsAutoFixed?: number;
  firstCheckOk?: boolean;
  rounds?: number;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; usd: number };
  ms: number;
  thinkPass?: boolean;
  regression?: { passed: number; total: number } | null;
}

export function load(tag: string): Rec[] {
  const out: Rec[] = [];
  for (const f of readdirSync(RESULTS)) {
    const m = /^(read|write|fix|change|think)-(qwen7b|opus|gpt)(?:-(.+))?\.jsonl$/.exec(f);
    if (!m) continue;
    if ((m[3] ?? "main") !== tag) continue;
    for (const l of readFileSync(join(RESULTS, f), "utf8").split("\n")) if (l.trim()) out.push({ ...JSON.parse(l), modelKey: m[2] } as Rec);
  }
  return out;
}

const modelKey = (r: Rec) => (r as unknown as { modelKey: string }).modelKey;
const outcome = (r: Rec) => (r.family === "read" ? !!r.correct : r.family === "think" ? !!r.thinkPass : !!r.pass);

/** Records belonging to a scoreboard row, keyed so that Canon and baseline arms can be compared. */
export function rowRecords(recs: Rec[], row: Row, model: string): Rec[] {
  const mine = recs.filter((r) => modelKey(r) === model);
  switch (row) {
    case "READ":
      return mine.filter((r) => r.family === "read");
    case "READ-effects":
      return mine.filter((r) => r.family === "read" && r.type === "effects");
    case "READ-property":
      return mine.filter((r) => r.family === "read" && r.type === "property");
    case "READ-output":
      return mine.filter((r) => r.family === "read" && (r.type === "output" || r.type === "failure"));
    case "WRITE":
      return mine.filter((r) => r.family === "write");
    case "FIX":
      return mine.filter((r) => r.family === "fix");
    case "CHANGE":
      return mine.filter((r) => r.family === "change");
    case "THINK":
      return mine.filter((r) => r.family === "think");
  }
}

/** seed -> arm -> mean outcome */
export function seedScores(recs: Rec[], value: (r: Rec) => number = (r) => (outcome(r) ? 1 : 0)): Map<string, Map<string, number>> {
  const acc = new Map<string, Map<string, [number, number]>>();
  for (const r of recs) {
    const s = acc.get(r.seed) ?? new Map();
    const a = s.get(r.arm) ?? [0, 0];
    a[0] += value(r);
    a[1]++;
    s.set(r.arm, a);
    acc.set(r.seed, s);
  }
  const out = new Map<string, Map<string, number>>();
  for (const [seed, arms] of acc) out.set(seed, new Map([...arms].map(([a, [s, n]]) => [a, s / n])));
  return out;
}

export function paired(scores: Map<string, Map<string, number>>, a: string, b: string): number[] {
  const d: number[] = [];
  for (const arms of scores.values()) if (arms.has(a) && arms.has(b)) d.push(arms.get(a)! - arms.get(b)!);
  return d;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

export function bootstrap(d: number[], B = 10000, seed = 20261123): { mean: number; lo: number; hi: number; p: number } {
  if (!d.length) return { mean: NaN, lo: NaN, hi: NaN, p: 1 };
  const r = mulberry32(seed);
  const ms: number[] = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[Math.floor(r() * d.length)];
    ms.push(s / d.length);
  }
  ms.sort((x, y) => x - y);
  const le0 = ms.filter((x) => x <= 0).length;
  return { mean: mean(d), lo: ms[Math.floor(0.025 * B)], hi: ms[Math.floor(0.975 * B) - 1], p: (le0 + 1) / (B + 1) };
}

export function holm(ps: number[]): number[] {
  const idx = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const adj = new Array(ps.length).fill(1);
  let run = 0;
  idx.forEach(([p, i], k) => {
    run = Math.max(run, Math.min(1, (ps.length - k) * p));
    adj[i] = run;
  });
  return adj;
}

export interface Cell {
  row: string;
  model: string;
  baseline: string;
  n: number;
  canon: number;
  base: number;
  others: Record<string, number>;
  d: number;
  lo: number;
  hi: number;
  p: number;
  pHolm?: number;
  verdict?: string;
}

function armMeans(scores: Map<string, Map<string, number>>, arm: string): number {
  return mean([...scores.values()].filter((m) => m.has(arm)).map((m) => m.get(arm)!));
}

export function analyze(tag: string, baselines: Record<string, string>, margin: number) {
  const recs = load(tag);
  const cells: Cell[] = [];
  for (const row of FAMILY_ROWS) {
    for (const model of MODELS) {
      const rr = rowRecords(recs, row, model);
      if (!rr.length) continue;
      const scores = seedScores(rr);
      const canonArm = row === "THINK" ? "canon->py" : "canon";
      const base = baselines[`${row}|${model}`] ?? baselines[row] ?? (row === "THINK" ? "py" : "py");
      const d = paired(scores, canonArm, base);
      const b = bootstrap(d);
      const arms = [...new Set(rr.map((r) => r.arm))];
      cells.push({
        row,
        model,
        baseline: base,
        n: d.length,
        canon: armMeans(scores, canonArm),
        base: armMeans(scores, base),
        others: Object.fromEntries(arms.map((a) => [a, armMeans(scores, a)])),
        d: b.mean,
        lo: b.lo,
        hi: b.hi,
        p: b.p,
      });
    }
  }
  // Holm across the scoreboard's primary cells: READ (overall), WRITE, FIX, CHANGE, THINK
  const primary = cells.filter((c) => ["READ", "WRITE", "FIX", "CHANGE", "THINK"].includes(c.row));
  const adj = holm(primary.map((c) => c.p));
  primary.forEach((c, i) => (c.pHolm = adj[i]));
  // secondary READ rows get their own Holm family
  const secondary = cells.filter((c) => c.row.startsWith("READ-"));
  const adj2 = holm(secondary.map((c) => c.p));
  secondary.forEach((c, i) => (c.pHolm = adj2[i]));
  for (const c of cells) {
    if (!c.n) c.verdict = "no data";
    else if ((c.pHolm ?? 1) < 0.025 && c.lo > 0) c.verdict = "win";
    else if (c.lo > -margin) c.verdict = "non-inferior";
    else if (c.hi < -margin) c.verdict = "lose";
    else c.verdict = "inconclusive";
  }

  // ---------------------------------------------------- secondary measures
  const perArm = (fam: string, model: string) => {
    const rr = recs.filter((r) => r.family === fam && modelKey(r) === model);
    const arms = [...new Set(rr.map((r) => r.arm))].sort();
    return arms.map((arm) => {
      const xs = rr.filter((r) => r.arm === arm);
      const acc = xs.filter((r) => r.accepted);
      const tokens = mean(xs.map((r) => r.usage.input + r.usage.cacheRead + r.usage.cacheWrite + r.usage.output));
      const passes = xs.filter((r) => outcome(r)).length;
      return {
        family: fam,
        model,
        arm,
        runs: xs.length,
        passRate: passes / xs.length,
        firstCheckOk: fam === "read" ? null : xs.filter((r) => r.firstCheckOk).length / xs.length,
        selfHealing: fam === "read" ? null : (() => {
          const rep = xs.reduce((s, r) => s + (r.errorsReported ?? 0), 0);
          return rep ? xs.reduce((s, r) => s + (r.errorsAutoFixed ?? 0), 0) / rep : null;
        })(),
        errorsReported: xs.reduce((s, r) => s + (r.errorsReported ?? 0), 0),
        falseAcceptance: fam === "read" || fam === "think" ? null : acc.length ? acc.filter((r) => !r.pass).length / acc.length : null,
        accepted: acc.length,
        meanRounds: fam === "read" ? null : mean(xs.map((r) => r.rounds ?? 0)),
        tokensPerRun: tokens,
        tokensPerPass: passes ? (tokens * xs.length) / passes : null,
        usd: xs.reduce((s, r) => s + r.usage.usd, 0),
        wallSeconds: xs.reduce((s, r) => s + r.ms, 0) / 1000,
        regressionRate: fam === "change" ? (() => {
          const t = xs.filter((r) => r.regression);
          return t.length ? t.filter((r) => r.regression!.passed < r.regression!.total).length / t.length : null;
        })() : null,
      };
    });
  };
  const secondaryRows = ["read", "write", "fix", "change", "think"].flatMap((f) => MODELS.flatMap((m) => perArm(f, m)));

  // cost: tokens per item, Canon vs baseline, per family and model (log ratio, bootstrap over seeds)
  const cost: { family: string; model: string; baseline: string; ratio: number; lo: number; hi: number; verdict: string }[] = [];
  for (const fam of ["read", "write", "fix", "change"]) {
    for (const model of MODELS) {
      const rr = recs.filter((r) => r.family === fam && modelKey(r) === model);
      if (!rr.length) continue;
      const row = fam.toUpperCase();
      const base = baselines[`${row}|${model}`] ?? baselines[row] ?? "py";
      const sc = seedScores(rr, (r) => r.usage.input + r.usage.cacheRead + r.usage.cacheWrite + r.usage.output);
      const d: number[] = [];
      for (const m of sc.values()) if (m.has("canon") && m.has(base) && m.get(base)! > 0) d.push(Math.log(m.get("canon")! / m.get(base)!));
      const b = bootstrap(d);
      cost.push({ family: fam, model, baseline: base, ratio: Math.exp(b.mean), lo: Math.exp(b.lo), hi: Math.exp(b.hi), verdict: b.lo > 0 ? "lose (more tokens)" : b.hi < 0 ? "win (fewer tokens)" : "inconclusive" });
    }
  }

  // the annotation ablation (READ): Canon vs stripped Canon; stripped Canon vs the baseline
  const ablation: { model: string; row: string; comparison: string; d: number; lo: number; hi: number; n: number }[] = [];
  for (const model of MODELS) {
    for (const row of ["READ", "READ-effects", "READ-property", "READ-output"] as Row[]) {
      const rr = rowRecords(recs, row, model);
      if (!rr.length) continue;
      const sc = seedScores(rr);
      const base = baselines[`${row}|${model}`] ?? baselines[row] ?? "py";
      for (const [a, b, label] of [["canon", "canon-stripped", "Canon - stripped Canon (value of the annotations)"], ["canon-stripped", base, `stripped Canon - ${base} (syntax alone)`]] as const) {
        const d = paired(sc, a, b);
        const bs = bootstrap(d);
        ablation.push({ model, row, comparison: label, d: bs.mean, lo: bs.lo, hi: bs.hi, n: d.length });
      }
    }
  }
  return { tag, margin, baselines, cells, secondary: secondaryRows, cost, ablation, records: recs.length };
}

// ---------------------------------------------------------------- report

const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}` : "–");
const sgn = (x: number) => (Number.isFinite(x) ? `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1)}` : "–");

export function markdown(a: ReturnType<typeof analyze>): string {
  const L: string[] = [];
  L.push(`## Scoreboard (${a.tag}; margin m = ${(100 * a.margin).toFixed(0)} points)`, "");
  L.push(`Each cell: verdict, Canon minus baseline in percentage points [95% bootstrap interval over seeds], Holm-adjusted p, seeds.`, "");
  L.push(`| Family | ${MODELS.map((m) => MODEL_IDS[m]).join(" | ")} |`, `| --- | ${MODELS.map(() => "---").join(" | ")} |`);
  for (const row of FAMILY_ROWS) {
    const cs = MODELS.map((m) => a.cells.find((c) => c.row === row && c.model === m));
    if (cs.every((c) => !c)) continue;
    L.push(`| ${row} | ${cs.map((c) => (c ? `**${c.verdict}** ${sgn(c.d)} [${sgn(c.lo)}, ${sgn(c.hi)}] p=${(c.pHolm ?? c.p).toFixed(3)} n=${c.n} (vs ${c.baseline})` : "not run")).join(" | ")} |`);
  }
  L.push("", "### Arm means per cell (seed-averaged, %)", "", "| Family | Model | " + "arms |", "| --- | --- | --- |");
  for (const c of a.cells) L.push(`| ${c.row} | ${c.model} | ${Object.entries(c.others).sort().map(([k, v]) => `${k} ${pct(v)}`).join(", ")} |`);
  L.push("", "### Cost: tokens per item, Canon / baseline", "", "| Family | Model | Baseline | Ratio [95% CI] | Verdict |", "| --- | --- | --- | --- | --- |");
  for (const c of a.cost) L.push(`| ${c.family} | ${c.model} | ${c.baseline} | ${c.ratio.toFixed(2)} [${c.lo.toFixed(2)}, ${c.hi.toFixed(2)}] | ${c.verdict} |`);
  L.push("", "### Annotation ablation (READ)", "", "| Model | Row | Comparison | Difference [95% CI] | n |", "| --- | --- | --- | --- | --- |");
  for (const x of a.ablation) L.push(`| ${x.model} | ${x.row} | ${x.comparison} | ${sgn(x.d)} [${sgn(x.lo)}, ${sgn(x.hi)}] | ${x.n} |`);
  L.push("", "### Per arm: pass rate, first-try check, self-healing, false acceptance, rounds, tokens, cost", "");
  L.push("| Family | Model | Arm | Runs | Pass % | First check ok % | Self-healing % (errors) | False acceptance % (accepted) | Rounds | Tokens/run | Tokens/pass | USD | Wall s | Regression % |");
  L.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const s of a.secondary) {
    L.push(
      `| ${s.family} | ${s.model} | ${s.arm} | ${s.runs} | ${pct(s.passRate)} | ${s.firstCheckOk === null ? "–" : pct(s.firstCheckOk)} | ${s.selfHealing === null ? "–" : pct(s.selfHealing)} (${s.errorsReported}) | ${s.falseAcceptance === null ? "–" : pct(s.falseAcceptance)} (${s.accepted}) | ${s.meanRounds === null ? "–" : s.meanRounds.toFixed(2)} | ${Math.round(s.tokensPerRun)} | ${s.tokensPerPass === null ? "–" : Math.round(s.tokensPerPass)} | ${s.usd.toFixed(2)} | ${Math.round(s.wallSeconds)} | ${s.regressionRate === null ? "–" : pct(s.regressionRate)} |`,
    );
  }
  return L.join("\n") + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("analyze.ts")) {
  const argv = process.argv;
  const opt = (n: string, d: string) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : d);
  const tag = opt("tag", "main");
  const bfile = opt("baselines", join(HERE, "baselines.json"));
  const baselines = existsSync(bfile) ? JSON.parse(readFileSync(bfile, "utf8")) : {};
  const a = analyze(tag, baselines, Number(opt("margin", "0.10")));
  writeFileSync(join(RESULTS, `scoreboard-${tag}.json`), JSON.stringify(a, null, 1) + "\n");
  writeFileSync(join(RESULTS, `scoreboard-${tag}.md`), markdown(a));
  console.log(markdown(a));
}
