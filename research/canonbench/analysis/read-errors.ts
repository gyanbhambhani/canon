/**
 * Exploratory (not pre-registered): how READ answers go wrong, per model and arm.
 * For set answers (effects, failure): over-inclusion (the answer contains every right name plus
 * extra ones), under-inclusion (a strict subset), or mixed. For property: false "yes" / false "no".
 * Over-inclusion on effects questions is where Python's and TypeScript's standard libraries are
 * genuinely ambiguous (urllib's urlopen also opens file:// URLs; a computed URL can reach any host),
 * so it is reported separately rather than treated like a plain miss.
 *   npx tsx --conditions=source analysis/read-errors.ts [--tag main]
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH } from "../lib/seed.js";

const tag = process.argv.includes("--tag") ? process.argv[process.argv.indexOf("--tag") + 1] : "main";
const rows: string[] = ["| Model | Arm | Type | Answers | Wrong | Over-inclusive | Under-inclusive | Mixed / other | False yes | False no | Unparsed |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
const out: unknown[] = [];
for (const m of ["qwen7b", "opus", "gpt"]) {
  const f = join(BENCH, "results", `read-${m}${tag === "main" ? "" : "-" + tag}.jsonl`);
  if (!existsSync(f)) continue;
  const R = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  for (const arm of ["canon", "canon-stripped", "py", "ts"]) {
    for (const type of ["effects", "failure", "property", "output"]) {
      const xs = R.filter((r) => r.arm === arm && r.type === type);
      if (!xs.length) continue;
      const wrong = xs.filter((r) => !r.correct);
      let over = 0, under = 0, mixed = 0, fy = 0, fn = 0, unp = 0;
      for (const r of wrong) {
        if (!r.parsed) { unp++; continue; }
        if (type === "property") { if (r.given === true) fy++; else fn++; continue; }
        if (type === "output") { mixed++; continue; }
        const a = new Set((r.answer as unknown[]).map(String));
        const g = new Set(Array.isArray(r.given) ? r.given.map(String) : []);
        const sup = [...a].every((x) => g.has(x));
        const sub = [...g].every((x) => a.has(x));
        if (sup && !sub) over++;
        else if (sub && !sup) under++;
        else mixed++;
      }
      out.push({ model: m, arm, type, n: xs.length, wrong: wrong.length, over, under, mixed, falseYes: fy, falseNo: fn, unparsed: unp });
      rows.push(`| ${m} | ${arm} | ${type} | ${xs.length} | ${wrong.length} | ${over} | ${under} | ${mixed} | ${fy} | ${fn} | ${unp} |`);
    }
  }
}
writeFileSync(join(BENCH, "results", `read-errors-${tag}.json`), JSON.stringify(out, null, 1) + "\n");
console.log(rows.join("\n"));
