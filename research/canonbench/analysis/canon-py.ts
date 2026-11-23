/**
 * Exploratory (amendment 2): the Canon-Py arm against brace Canon on Qwen 7B, and the "Rust-isms"
 * in Qwen's first drafts. Reads results/{write,fix,change}-qwen7b{,-pilot,-cpy}.jsonl and the
 * THINK files. Writes results/canon-py.json and prints Markdown.
 *   npx tsx --conditions=source analysis/canon-py.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkCode } from "../arms/check.js";
import { BENCH } from "../lib/seed.js";

const load = (f: string) => (existsSync(join(BENCH, "results", f)) ? readFileSync(join(BENCH, "results", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const PILOT = ["caesar_shift", "parse_duration", "stack_vm", "invoice_total", "build_order", "max_subarray", "text_editor", "parse_money", "k_most_frequent", "tic_tac_toe"];

/** Strip string literals and comments before counting, so text inside strings is not counted. */
function code(src: string): string {
  return src.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/^\s*(#|\/\/).*$/gm, "");
}
const RUSTISMS: [string, RegExp][] = [
  ["let mut", /\blet\s+mut\b/g],
  ["& borrow", /(?<![&\w)\]])&(?!&)\s*(mut\s+)?[A-Za-z_[(]/g],
  [".method() call", /\.[a-z_][A-Za-z0-9_]*\s*\(/g],
  ["format!", /\bformat!/g],
  ["char literal", /'(?:[^'\\\n]|\\.)'/g],
  ["null", /\bnull\b/g],
  ["+=", /\+=/g],
  // Python-isms outside Canon-Py's subset (and outside brace Canon)
  ["dict/set literal", /[=(,:]\s*\{(?!\s*$)/g],
  ["slice x[a:b]", /\[[^\]\n]*:[^\]\n]*\]/g],
  ["import / from", /^\s*(import|from)\s/gm],
];

function rustisms(drafts: string[]) {
  return RUSTISMS.map(([name, re]) => {
    let total = 0;
    let withIt = 0;
    for (const d of drafts) {
      const n = (code(d).match(re) ?? []).length;
      total += n;
      if (n) withIt++;
    }
    return { name, draftsWithIt: withIt, share: drafts.length ? withIt / drafts.length : 0, occurrences: total };
  });
}

const out: Record<string, unknown> = {};
const md: string[] = [];
// ---------------------------------------------------------------- per family, brace vs Canon-Py
md.push("| Family | Arm | Seeds | Runs | Pass % | First draft checks % | Runs with a parse error (P001) | ...fixed by feedback | Final program unchanged after feedback | Most common remaining codes |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
const families = ["write", "fix", "change"];
for (const fam of families) {
  const brace = [...load(`${fam}-qwen7b.jsonl`), ...load(`${fam}-qwen7b-pilot.jsonl`)].filter((r) => r.arm === "canon");
  const cpy = load(`${fam}-qwen7b-cpy.jsonl`);
  const seeds = new Set(cpy.map((r: { seed: string }) => r.seed));
  for (const [arm, recs] of [["canon (brace)", brace.filter((r) => seeds.has(r.seed))], ["canon-py", cpy]] as const) {
    if (!recs.length) continue;
    const lang = (r: { arm: string }) => (r.arm === "cpy" ? "cpy" : "canon");
    const parse = recs.filter((r) => checkCode(lang(r), r.initial).codes.includes("P001"));
    const parseFixed = parse.filter((r) => r.firstCheckOk === false && r.tests !== null);
    // remaining codes: the checker re-run on the final program of each run that never checked clean
    const never = recs.filter((r) => r.tests === null);
    const codes: Record<string, number> = {};
    for (const r of never) for (const c of new Set<string>(checkCode(lang(r), r.final).codes)) codes[c] = (codes[c] ?? 0) + 1;
    const top = Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} (${n})`).join(", ");
    const unchanged = recs.filter((r) => r.rounds > 0 && r.final.trim() === r.initial.trim()).length;
    const row = {
      family: fam,
      arm,
      seeds: new Set(recs.map((r) => r.seed)).size,
      runs: recs.length,
      pass: recs.filter((r) => r.pass).length / recs.length,
      firstCheck: recs.filter((r) => r.firstCheckOk).length / recs.length,
      parseRuns: parse.length,
      parseFixed: parseFixed.length,
      topCodes: top,
      unchangedResubmissions: unchanged,
    };
    out[`${fam}|${arm}`] = row;
    md.push(`| ${fam} | ${arm} | ${row.seeds} | ${row.runs} | ${(100 * row.pass).toFixed(1)} | ${(100 * row.firstCheck).toFixed(1)} | ${row.parseRuns} | ${row.parseFixed} | ${unchanged} | ${top || "–"} |`);
  }
}
// THINK
for (const [arm, f] of [["canon->py (brace)", "think-qwen7b.jsonl"], ["canon->py (brace, pilot)", "think-qwen7b-pilot.jsonl"], ["canon-py->py", "think-qwen7b-cpy.jsonl"]] as const) {
  const recs = load(f).filter((r: { arm: string }) => r.arm !== "py");
  if (!recs.length) continue;
  md.push(`| think | ${arm} | ${new Set(recs.map((r: { seed: string }) => r.seed)).size} | ${recs.length} | ${(100 * recs.filter((r: { thinkPass: boolean }) => r.thinkPass).length / recs.length).toFixed(1)} | | | | | |`);
}
// ---------------------------------------------------------------- Rust-isms in first drafts
const braceDrafts = [...load("write-qwen7b.jsonl"), ...load("write-qwen7b-pilot.jsonl")].filter((r) => r.arm === "canon").map((r) => r.initial as string);
const cpyDrafts = load("write-qwen7b-cpy.jsonl").map((r: { initial: string }) => r.initial);
const pyDrafts = [...load("write-qwen7b.jsonl"), ...load("write-qwen7b-pilot.jsonl")].filter((r) => r.arm === "py").map((r) => r.initial as string);
const rb = rustisms(braceDrafts);
const rc = rustisms(cpyDrafts);
const rp = rustisms(pyDrafts);
out.rustisms = { brace: { drafts: braceDrafts.length, counts: rb }, canonPy: { drafts: cpyDrafts.length, counts: rc }, python: { drafts: pyDrafts.length, counts: rp } };
md.push("", `Rust-isms in Qwen 7B's WRITE first drafts (share of drafts with at least one; occurrences in parentheses). Brace Canon: ${braceDrafts.length} drafts; Canon-Py: ${cpyDrafts.length}; Python (for reference): ${pyDrafts.length}.`, "");
md.push("| Pattern | Brace Canon | Canon-Py | Python arm |", "| --- | --- | --- | --- |");
rb.forEach((x, i) => md.push(`| \`${x.name}\` | ${(100 * x.share).toFixed(0)}% (${x.occurrences}) | ${(100 * rc[i].share).toFixed(0)}% (${rc[i].occurrences}) | ${(100 * rp[i].share).toFixed(0)}% (${rp[i].occurrences}) |`));
writeFileSync(join(BENCH, "results", "canon-py.json"), JSON.stringify(out, null, 1) + "\n");
console.log(md.join("\n"));
