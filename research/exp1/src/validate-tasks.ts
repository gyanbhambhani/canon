/**
 * Validate the Experiment 1 task set: for every task, both reference solutions must pass the
 * harness's check (tsc --strict / canon check) and every test. Ids must be unique.
 * Run from research/benchmark: npx tsx --conditions=source ../exp1/src/validate-tasks.ts
 */
import { canon, typescript } from "../../benchmark/src/languages.js";
import { REFERENCE_CANON } from "./reference-canon.js";
import { REFERENCE_TS } from "./reference-ts.js";
import { HARD_TASKS } from "./tasks.js";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`FAIL ${msg}`);
};

const ids = new Set<string>();
for (const t of HARD_TASKS) {
  if (ids.has(t.id)) fail(`duplicate id ${t.id}`);
  ids.add(t.id);
  if (t.tier !== "hard") fail(`${t.id}: tier is ${t.tier}`);
  if (t.tests.length < 6 || t.tests.length > 10) fail(`${t.id}: ${t.tests.length} tests (want 6 to 10)`);
  for (const [lang, refs] of [[typescript, REFERENCE_TS], [canon, REFERENCE_CANON]] as const) {
    const src = refs[t.id];
    if (!src) {
      fail(`${t.id} ${lang.id}: no reference solution`);
      continue;
    }
    const decls = lang.id === "canon" ? t.decls?.canon : t.decls?.ts;
    if (decls && !src.startsWith(decls)) fail(`${t.id} ${lang.id}: reference does not start with the task's decls`);
    const c = lang.check(src);
    if (!c.ok) {
      fail(`${t.id} ${lang.id}: check failed\n${c.feedback}`);
      continue;
    }
    const r = lang.test(src, t);
    if (r.passed !== r.total) fail(`${t.id} ${lang.id}: ${r.passed}/${r.total} tests${r.error ? ` (${r.error})` : ""}`);
  }
}
for (const [name, refs] of [["REFERENCE_TS", REFERENCE_TS], ["REFERENCE_CANON", REFERENCE_CANON]] as const) {
  for (const id of Object.keys(refs)) if (!ids.has(id)) fail(`${name} has ${id}, which is not a task`);
}

const tests = HARD_TASKS.reduce((n, t) => n + t.tests.length, 0);
console.log(`${HARD_TASKS.length} tasks, ${tests} tests, ${failures} failures`);
process.exit(failures || HARD_TASKS.length !== 60 ? 1 : 0);
