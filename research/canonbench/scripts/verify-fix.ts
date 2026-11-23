/** Re-verify every FIX item: the mutant passes its checker and fails at least one hidden test. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runTests } from "../adapters/exec.js";
import { checkCode } from "../arms/check.js";
import type { FixItem } from "../generators/fix.js";
import { BENCH, loadSeed, loadTests } from "../lib/seed.js";

const items: FixItem[] = readFileSync(join(BENCH, "items", "fix.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
let bad = 0;
for (const it of items) {
  const c = checkCode(it.lang, it.broken);
  const t = runTests(it.lang, it.broken, loadSeed(it.seed), loadTests(it.seed));
  if (!c.ok || t.passed === t.total) {
    bad++;
    console.log(`FAIL ${it.fid}: check ${c.ok}, tests ${t.passed}/${t.total}`);
  }
}
console.log(`${items.length} FIX items, ${bad} failures`);
process.exit(bad ? 1 : 0);
