/**
 * SHA-256 of every pre-registered file: items, seeds, tests, references, change and effect items,
 * prompt templates, toolchain arms, runner and analysis. Writes MANIFEST.sha256 (sha256sum format)
 * and prints a combined hash.  npx tsx --conditions=source scripts/hash.ts
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BENCH } from "../lib/seed.js";

const ROOTS = ["seeds", "tests", "refs", "change", "effects", "items", "arms", "adapters", "sandbox", "lib", "generators", "runner/run.ts", "runner/models.ts", "analysis/analyze.ts", "analysis/think.ts", "analysis/baselines.json"];
const files: string[] = [];
const walk = (p: string) => {
  const s = statSync(p);
  if (s.isDirectory()) {
    for (const f of readdirSync(p).sort()) if (f !== "__pycache__" && !f.startsWith(".")) walk(join(p, f));
  } else if (!/\.pyc$/.test(p)) files.push(p);
};
for (const r of ROOTS) walk(join(BENCH, r));
const lines = files.map((f) => `${createHash("sha256").update(readFileSync(f)).digest("hex")}  ${relative(BENCH, f)}`);
writeFileSync(join(BENCH, "MANIFEST.sha256"), lines.join("\n") + "\n");
console.log(`${files.length} files; combined sha256 ${createHash("sha256").update(lines.join("\n")).digest("hex")}`);
for (const k of ["items/read.jsonl", "items/fix.jsonl", "items/write.txt", "items/change.txt", "arms/prompts.ts", "analysis/analyze.ts", "analysis/think.ts"]) {
  console.log(lines.find((l) => l.endsWith(`  ${k}`)));
}
