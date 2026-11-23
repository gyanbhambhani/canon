/**
 * Phase 1: copy Experiment 1's 60 hard tasks into CanonBench's language-neutral layout.
 *   seeds/<id>.json      spec, signature, two examples, declarations, tags
 *   tests/<id>.json      the hidden tests (args, expected); a Result's expected value encodes the error
 *   refs/canon/<id>.cn   Experiment 1's Canon reference
 *   refs/ts/<id>.ts      Experiment 1's TypeScript reference
 * The Python references (refs/py) are written by hand, idiomatically, never generated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE_CANON } from "../../exp1/src/reference-canon.js";
import { REFERENCE_TS } from "../../exp1/src/reference-ts.js";
import { HARD_TASKS } from "../../exp1/src/tasks.js";
import { BENCH } from "../lib/seed.js";

for (const d of ["seeds", "tests", "refs/canon", "refs/ts", "refs/py"]) mkdirSync(join(BENCH, d), { recursive: true });
for (const t of HARD_TASKS) {
  const resultTyped = t.ret.startsWith("Result");
  const seed = {
    id: t.id,
    source: "exp1-hard",
    fn: t.fn,
    params: t.params,
    ret: t.ret,
    desc: t.desc,
    examples: t.tests.slice(0, 2).map(([args, expected]) => ({ args, expected })),
    decls: t.decls ?? { canon: "", ts: "" },
    typeKinds: t.typeKinds ?? {},
    tags: [resultTyped ? "result" : "total", ...(t.typeKinds && Object.keys(t.typeKinds).length ? ["adt"] : [])],
  };
  writeFileSync(join(BENCH, "seeds", `${t.id}.json`), JSON.stringify(seed, null, 2) + "\n");
  writeFileSync(join(BENCH, "tests", `${t.id}.json`), JSON.stringify({ id: t.id, cases: t.tests.map(([args, expected]) => ({ args, expected })) }, null, 1) + "\n");
  writeFileSync(join(BENCH, "refs/canon", `${t.id}.cn`), REFERENCE_CANON[t.id]);
  writeFileSync(join(BENCH, "refs/ts", `${t.id}.ts`), REFERENCE_TS[t.id]);
}
console.log(`exported ${HARD_TASKS.length} seeds`);
