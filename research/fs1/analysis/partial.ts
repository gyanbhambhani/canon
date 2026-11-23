/**
 * Partial-run subset (PREREGISTRATION.md, Amendment 3): the GPT main-run records restricted to the
 * tasks where all three arms have the same number of non-infrastructure runs, so the arms stay
 * paired. Writes results/partial-gpt.jsonl (not matched by the analysis' results/main-*.jsonl glob)
 * and prints the composition. The pre-registered analysis (analyze.ts) then runs on that file.
 *   npx tsx --conditions=source analysis/partial.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARMS, FS1, adaptedTasks, infrastructureFailure, load, type Rec } from "./analyze";

const recs: Rec[] = load(["results/main-gpt.jsonl", "results/main-gpt-r3.jsonl"]).filter((r) => !infrastructureFailure(r));
const count = new Map<string, number>();
for (const r of recs) count.set(`${r.task}|${r.arm}`, (count.get(`${r.task}|${r.arm}`) ?? 0) + 1);
const tasks = [...new Set(recs.map((r) => r.task))].sort();
const n = (t: string, a: string) => count.get(`${t}|${a}`) ?? 0;
const paired = tasks.filter((t) => ARMS.every((a) => n(t, a) === n(t, ARMS[0])));
const kept = recs.filter((r) => paired.includes(r.task));
writeFileSync(join(FS1, "results/partial-gpt.jsonl"), kept.map((r) => JSON.stringify(r)).join("\n") + "\n");

const adapted = adaptedTasks();
const kind = (t: string) => JSON.parse(readFileSync(join(FS1, "tasks", t, "task.json"), "utf8")).kind as string;
const byRuns = (k: number) => paired.filter((t) => n(t, "direct") === k);
console.log(`GPT real runs: ${recs.length}. Tasks with any real run: ${tasks.length} of 60.`);
console.log(`Paired subset (same run count in all three arms): ${paired.length} tasks, ${kept.length} runs.`);
console.log(`  2 runs per arm: ${byRuns(2).length} tasks; 1 run per arm: ${byRuns(1).length} tasks.`);
console.log(`  feature ${paired.filter((t) => kind(t) === "feature").length}, change ${paired.filter((t) => kind(t) === "change").length}, adapted ${paired.filter((t) => adapted.has(t)).length}.`);
console.log(`  tasks: ${paired.join(", ")}`);
console.log(`Excluded for unequal counts: ${tasks.filter((t) => !paired.includes(t)).map((t) => `${t} (${ARMS.map((a) => n(t, a)).join("/")})`).join(", ")}`);
const all = readdirSync(join(FS1, "tasks")).filter((d) => d !== "README.md" && !d.startsWith("BATCH"));
console.log(`No GPT run at all: ${all.filter((d) => !tasks.includes(d)).length} tasks (${all.filter((d) => !tasks.includes(d)).join(", ")})`);
