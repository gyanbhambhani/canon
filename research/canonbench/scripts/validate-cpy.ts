/**
 * The exploratory Canon-Py arm (amendment 2): every Canon reference, printed in Canon-Py, passes
 * `canon check --syntax py`, starts with the Canon-Py declarations the prompt shows, and passes every
 * hidden test, on the JS runtime and after compiling to Python.
 */
import { runTests } from "../adapters/exec.js";
import { checkCode } from "../arms/check.js";
import { toCanonPy, writePrompt } from "../arms/prompts.js";
import { loadRef, loadSeed, loadTests, seedIds } from "../lib/seed.js";

let bad = 0;
for (const id of seedIds()) {
  const seed = loadSeed(id);
  const src = toCanonPy(loadRef("canon", id)!) + "\n";
  const c = checkCode("cpy", src);
  if (!c.ok) {
    bad++;
    console.log(`FAIL ${id}: check\n${c.feedback.slice(0, 600)}`);
    continue;
  }
  const t = runTests("cpy", src, seed, loadTests(id));
  const p = runTests("cpypy", src, seed, loadTests(id));
  if (t.passed !== t.total || p.passed !== p.total) {
    bad++;
    console.log(`FAIL ${id}: js ${t.passed}/${t.total}, python ${p.passed}/${p.total}`);
  }
  if (seed.decls.canon && !src.startsWith(toCanonPy(seed.decls.canon))) {
    bad++;
    console.log(`FAIL ${id}: declarations differ`);
  }
}
console.log(writePrompt("cpy", loadSeed("stack_vm")).slice(0, 900));
console.log(`60 Canon-Py references: ${bad} failures`);
