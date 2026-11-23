// Dumps the benchmark task specs (ids, tiers, tests) to tasks.json so the Python harness uses the exact test cases.
// Run: node research/v0.3/tokens/dump_tasks.mjs
import { writeFileSync } from "node:fs";
import { TASKS } from "../../benchmark/src/tasks.ts";
writeFileSync(new URL("./tasks.json", import.meta.url), JSON.stringify(TASKS, null, 1));
console.log(TASKS.length, "tasks");
