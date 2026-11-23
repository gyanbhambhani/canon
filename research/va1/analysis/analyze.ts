/**
 * VA-1 analysis. Every number in REPORT.md comes from this script's output (results/analysis.json
 * and results/analysis.md), computed from results/references.jsonl and results/*.jsonl runs.
 *   tsx analysis/analyze.ts
 *
 * Unit: the task, paired across arms. 95% bootstrap intervals over tasks, seed 2026, 10,000 resamples.
 * Primary comparison (pre-registered): validation agreement, Canon minus Schema-driven, Set 2, per model.
 * Outcomes: win (interval above 0), non-inferior (lower end above -0.03), lose (interval below 0),
 * inconclusive. A paired task needs both arms to have a value (for model runs: at least one completed run).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "../harness/generator";
import { VA1 } from "../harness/arms";

const R = join(VA1, "results");
const MARGIN = 0.03;
const lines = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f3 = (x: number) => (Number.isNaN(x) ? "n/a" : x.toFixed(3));

function bootstrap(diffs: number[]): { mean: number; lo: number; hi: number; n: number } {
  if (!diffs.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const rand = mulberry32(2026);
  const means: number[] = [];
  for (let b = 0; b < 10_000; b++) {
    let s = 0;
    for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rand() * diffs.length)];
    means.push(s / diffs.length);
  }
  means.sort((a, b) => a - b);
  return { mean: mean(diffs), lo: means[Math.floor(0.025 * 10_000)], hi: means[Math.floor(0.975 * 10_000) - 1], n: diffs.length };
}
const verdict = (c: { lo: number; hi: number }) =>
  Number.isNaN(c.lo) ? "no data" : c.lo > 0 ? "win" : c.lo > -MARGIN ? "non-inferior" : c.hi < 0 ? "lose" : "inconclusive";
const ci = (c: ReturnType<typeof bootstrap>) => `${c.mean >= 0 ? "+" : ""}${f3(c.mean)} [${f3(c.lo)}, ${f3(c.hi)}] (n=${c.n}) ${verdict(c)}`;

type Arm = "hand" | "schema" | "canon";
const ARMS: Arm[] = ["hand", "schema", "canon"];

/** per-(task, arm) values: agreement, bounce rate, block rate, completion. */
interface Cell {
  task: string;
  set: number;
  adapted: boolean;
  arm: Arm;
  /** agreement of the (completed) runs, averaged over them; null: no completed run */
  agreement: number | null;
  /** agreement counting a run that did not complete as 0 */
  agreementZero: number;
  bounce: number | null;
  block: number | null;
  runs: number;
  completed: number;
}

function cellsFromReferences(rows: any[]): Cell[] {
  return rows
    .filter((r) => r.task !== "(starter)")
    .map((r) => ({
      task: r.task, set: r.set, adapted: !!r.adapted, arm: r.arm, agreement: r.ok ? r.agreement : null,
      agreementZero: r.ok ? r.agreement : 0, bounce: r.ok ? r.bounce / r.samples : null, block: r.ok ? r.block / r.samples : null, runs: 1, completed: r.ok ? 1 : 0,
    }));
}

function cellsFromRuns(rows: any[]): Cell[] {
  const by = new Map<string, any[]>();
  for (const r of rows) {
    const k = `${r.task}|${r.arm}`;
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  return [...by.values()].map((rs) => {
    const done = rs.filter((r) => r.pass && r.agreement);
    const ag = (r: any) => r.agreement.agree / r.agreement.samples;
    return {
      task: rs[0].task, set: rs[0].set, adapted: rs[0].adapted, arm: rs[0].arm,
      agreement: done.length ? mean(done.map(ag)) : null,
      agreementZero: mean(rs.map((r) => (r.pass && r.agreement ? ag(r) : 0))),
      bounce: done.length ? mean(done.map((r) => r.agreement.bounce / r.agreement.samples)) : null,
      block: done.length ? mean(done.map((r) => r.agreement.block / r.agreement.samples)) : null,
      runs: rs.length, completed: done.length,
    };
  });
}

function section(title: string, cells: Cell[], md: string[], out: Record<string, unknown>) {
  md.push(`\n### ${title}\n`);
  const sel = (set: number, arm: Arm, adaptedOut = false) => cells.filter((c) => c.set === set && c.arm === arm && (!adaptedOut || !c.adapted));
  const res: Record<string, unknown> = {};
  md.push("| set | arm | tasks | runs | completed | agreement (completed runs) | agreement (not completed = 0) | client-valid/server-invalid (bounce) | client-invalid/server-valid (block) |");
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const set of [1, 2]) {
    for (const arm of ARMS) {
      const cs = sel(set, arm);
      const withData = cs.filter((c) => c.agreement !== null);
      const row = {
        tasks: cs.length, runs: cs.reduce((a, c) => a + c.runs, 0), completed: cs.reduce((a, c) => a + c.completed, 0),
        agreement: mean(withData.map((c) => c.agreement!)), agreementZero: mean(cs.map((c) => c.agreementZero)),
        bounce: mean(withData.map((c) => c.bounce!)), block: mean(withData.map((c) => c.block!)),
      };
      res[`set${set}.${arm}`] = row;
      md.push(`| ${set} | ${arm} | ${row.tasks} | ${row.runs} | ${row.completed} | ${f3(row.agreement)} | ${f3(row.agreementZero)} | ${f3(row.bounce)} | ${f3(row.block)} |`);
    }
  }
  // paired comparisons over tasks where both arms have a completed value
  md.push("\nPaired differences in agreement (completed runs), mean over tasks with a 95% bootstrap interval:\n");
  md.push("| set | comparison | all tasks | without adapted tasks | not completed = 0 |");
  md.push("| --- | --- | --- | --- | --- |");
  const pairs: [Arm, Arm][] = [["canon", "schema"], ["canon", "hand"], ["schema", "hand"]];
  for (const set of [1, 2]) {
    for (const [a, b] of pairs) {
      const diff = (adaptedOut: boolean, key: "agreement" | "agreementZero") => {
        const A = new Map(sel(set, a, adaptedOut).map((c) => [c.task, c]));
        const d: number[] = [];
        for (const c of sel(set, b, adaptedOut)) {
          const x = A.get(c.task);
          if (x && x[key] !== null && c[key] !== null) d.push((x[key] as number) - (c[key] as number));
        }
        return bootstrap(d);
      };
      const all = diff(false, "agreement");
      const noad = diff(true, "agreement");
      const zero = diff(false, "agreementZero");
      res[`set${set}.${a}-${b}`] = { all, withoutAdapted: noad, zero, verdict: verdict(all) };
      md.push(`| ${set} | ${a} - ${b}${set === 2 && a === "canon" && b === "schema" ? " (PRIMARY)" : ""} | ${ci(all)} | ${ci(noad)} | ${ci(zero)} |`);
    }
  }
  out[title] = res;
}

const md: string[] = ["# VA-1 analysis (generated by analysis/analyze.ts; do not edit)\n"];
const out: Record<string, unknown> = {};

const refs = lines(join(R, "references.jsonl"));
if (refs.length) {
  const failed = refs.filter((r) => !r.ok && r.task !== "(starter)");
  md.push(`References: ${refs.filter((r) => r.task !== "(starter)").length} (task, arm) results, ${failed.length} not verified.`);
  section("Phase 1: references only (the tools' ceiling)", cellsFromReferences(refs), md, out);
  // per-rule-category agreement in the references: which kinds of inputs drift
  md.push("\nReferences: disagreements by input category (summed over tasks; a category is `base`, `inside`, `outside` or `random`):\n");
  md.push("| arm | category | inputs | agree | bounce | block |");
  md.push("| --- | --- | --- | --- | --- | --- |");
  for (const arm of ARMS) {
    const tot: Record<string, { n: number; agree: number; bounce: number; block: number }> = {};
    for (const r of refs.filter((x) => x.arm === arm && x.byCategory))
      for (const [cat, v] of Object.entries(r.byCategory as Record<string, { n: number; agree: number; bounce: number; block: number }>)) {
        const k = cat.split(":")[0];
        const t = (tot[k] ??= { n: 0, agree: 0, bounce: 0, block: 0 });
        t.n += v.n; t.agree += v.agree; t.bounce += v.bounce; t.block += v.block;
      }
    for (const [k, t] of Object.entries(tot)) md.push(`| ${arm} | ${k} | ${t.n} | ${t.agree} | ${t.bounce} | ${t.block} |`);
  }
  // tasks with any disagreement
  const dis = refs.filter((r) => r.agreement !== null && r.agreement < 1).map((r) => `${r.task}/${r.arm} ${f3(r.agreement)}`);
  md.push(`\nReference (task, arm) pairs below 1.000: ${dis.length ? dis.join(", ") : "none"}.`);
}

for (const f of existsSync(R) ? readdirSync(R).filter((n) => /^(qwen|gpt).*\.jsonl$/.test(n)).sort() : []) {
  const rows = lines(join(R, f));
  if (!rows.length) continue;
  const model = rows[0].model;
  const keys = new Set(rows.map((r) => r.key));
  md.push(`\n## Phase 2: ${model} (${f}): ${keys.size} runs recorded`);
  const gate = (arm: Arm) => rows.filter((r) => r.arm === arm);
  md.push("\n| arm | runs | completed (gate) | checks ok | mean edit rounds | mean input tokens | referenceTokens |");
  md.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const arm of ARMS) {
    const g = gate(arm);
    md.push(`| ${arm} | ${g.length} | ${g.filter((r) => r.pass).length} | ${g.filter((r) => r.checksOk).length} | ${f3(mean(g.map((r) => r.editRounds)))} | ${Math.round(mean(g.map((r) => r.usage.input)))} | ${g[0]?.referenceTokens ?? 0} |`);
  }
  section(`Phase 2: ${model}`, cellsFromRuns(rows), md, out);
}

writeFileSync(join(R, "analysis.json"), JSON.stringify(out, null, 2) + "\n");
writeFileSync(join(R, "analysis.md"), md.join("\n") + "\n");
console.log(md.join("\n"));
