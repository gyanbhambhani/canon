/** Writes results/references.json: the phase 1 numbers, from results/references.jsonl and results/analysis.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VA1 } from "../harness/arms";

const R = join(VA1, "results");
const analysis = JSON.parse(readFileSync(join(R, "analysis.json"), "utf8"));
const rows = readFileSync(join(R, "references.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.task !== "(starter)");
const perTask = rows.map((r) => ({
  task: r.task, set: r.set, adapted: !!r.adapted, arm: r.arm, verified: r.ok, agreement: r.agreement, bounce: r.bounce, block: r.block, samples: r.samples,
}));
const summary = analysis["Phase 1: references only (the tools' ceiling)"];
writeFileSync(join(R, "references.json"), JSON.stringify({ note: "Phase 1, references only; summary from analysis/analyze.ts", summary, perTask }, null, 1) + "\n");
console.log(`wrote ${perTask.length} rows`);
