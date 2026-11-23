import { isDeepStrictEqual } from "node:util";
import { REFERENCE } from "./reference.js";
import { TASKS } from "./tasks.js";

let bad = 0;
const ids = new Set<string>();
for (const t of TASKS) {
  if (ids.has(t.id)) throw new Error(`duplicate ${t.id}`);
  ids.add(t.id);
  const f = REFERENCE[t.fn];
  if (!f) throw new Error(`no reference for ${t.fn}`);
  for (const [args, want] of t.tests) {
    const got = f(...args);
    if (!isDeepStrictEqual(got, want)) {
      bad++;
      console.log(`${t.id}(${JSON.stringify(args)}) = ${JSON.stringify(got)}, task says ${JSON.stringify(want)}`);
    }
  }
}
console.log(`${TASKS.length} tasks, ${TASKS.reduce((n, t) => n + t.tests.length, 0)} tests, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
