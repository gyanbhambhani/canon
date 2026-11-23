/**
 * The cost check: mean USD per run per family from the pilot, times the main run's planned runs.
 * Prints a Markdown table and writes results/cost-projection.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH } from "../lib/seed.js";

const RUNS = 3;
const planned: Record<string, number> = {
  read: 198 * 4 * RUNS,
  write: 60 * 3 * RUNS,
  fix: 101 * 3 * RUNS,
  change: 24 * 3 * RUNS,
};
const rows = ["| Model | Family | Pilot runs | Pilot USD/run | Planned runs | Projected USD |", "| --- | --- | --- | --- | --- | --- |"];
const out: Record<string, number> = {};
for (const m of ["opus", "gpt"]) {
  let total = 0;
  for (const f of Object.keys(planned)) {
    const p = join(BENCH, "results", `${f}-${m}-pilot.jsonl`);
    if (!existsSync(p)) continue;
    const R = readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const per = R.reduce((a, r) => a + r.usage.usd, 0) / R.length;
    const proj = per * planned[f];
    total += proj;
    rows.push(`| ${m} | ${f} | ${R.length} | ${per.toFixed(4)} | ${planned[f]} | ${proj.toFixed(2)} |`);
  }
  out[m] = total;
  rows.push(`| ${m} | **total** | | | | **${total.toFixed(2)}** (cap 150) |`);
}
writeFileSync(join(BENCH, "results", "cost-projection.json"), JSON.stringify(out, null, 1) + "\n");
console.log(rows.join("\n"));
