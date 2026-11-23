/**
 * Validate the Canon-Py arm (canon-py-arm.ts) on Experiment 1's hard tasks: each Canon reference
 * solution, converted to Canon-Py with fmt, must pass the arm's check and every hidden test, and
 * the arm's prompt must end with exactly the canon arm's request for output.
 * Run from research/benchmark: npx tsx --conditions=source ../v0.4/validate-canon-py-arm.ts
 */
import { fmt, V04_PY } from "@canon/compiler";
import { canon } from "../benchmark/src/languages.js";
import { REFERENCE_CANON } from "../exp1/src/reference-canon.js";
import { HARD_TASKS } from "../exp1/src/tasks.js";
import { canonPy } from "./canon-py-arm.js";

let failures = 0;
const OUTPUT = "Reply with only the complete program in one ```canon code block.";
for (const t of HARD_TASKS) {
  const ref = REFERENCE_CANON[t.id];
  const pyRef = fmt(ref, { features: V04_PY });
  const c = canonPy.check(pyRef);
  if (!c.ok) {
    failures++;
    console.log(`FAIL ${t.id}: check\n${c.feedback}`);
    continue;
  }
  const r = canonPy.test(pyRef, t);
  if (r.passed !== r.total) {
    failures++;
    console.log(`FAIL ${t.id}: ${r.passed}/${r.total}${r.error ? ` (${r.error})` : ""}`);
  }
  const p = canonPy.prompt(t);
  if (!p.endsWith(OUTPUT) || !canon.prompt(t).endsWith(OUTPUT)) {
    failures++;
    console.log(`FAIL ${t.id}: the output request differs between arms`);
  }
  if (/\bfn \w+\(|: (Int|String|List)\b/.test(p)) {
    failures++;
    console.log(`FAIL ${t.id}: the Canon-Py prompt still shows brace syntax:\n${p}`);
  }
}
console.log(`${HARD_TASKS.length - failures} of ${HARD_TASKS.length} tasks pass in Canon-Py`);
console.log("--- sample prompt ---\n" + canonPy.prompt(HARD_TASKS[0]));
process.exitCode = failures ? 1 : 0;
