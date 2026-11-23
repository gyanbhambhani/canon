/**
 * Phase 2: from the pilot, (1) choose each cell's baseline (the better of Python and TypeScript on
 * the pilot; ties go to Python) and (2) the power analysis: the SD of the per-seed paired difference
 * (Canon - baseline), and the minimum detectable effect for the main run's seed count at 80% power,
 * two-sided alpha 0.05: MDE = 2.80 * sd / sqrt(n). Writes analysis/baselines.json and
 * results/power-pilot.json, and prints a Markdown table for PREREGISTRATION.md.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FAMILY_ROWS, load, MODELS, paired, rowRecords, seedScores } from "./analyze.js";

const HERE = new URL(".", import.meta.url).pathname;
const MAIN_SEEDS: Record<string, number> = {
  READ: 76, "READ-effects": 16, "READ-property": 52, "READ-output": 60, WRITE: 60, FIX: 53, CHANGE: 24, THINK: 60,
};
const recs = load("pilot");
const baselines: Record<string, string> = {};
const rows: string[] = [];
const power: unknown[] = [];
rows.push("| Cell | Pilot seeds | Canon | Python | TypeScript | Baseline | SD of paired difference | MDE at main-run n |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const row of FAMILY_ROWS) {
  for (const model of MODELS) {
    const rr = rowRecords(recs, row, model);
    if (!rr.length) continue;
    const sc = seedScores(rr);
    const m = (arm: string) => {
      const xs = [...sc.values()].filter((x) => x.has(arm)).map((x) => x.get(arm)!);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
    };
    const canonArm = row === "THINK" ? "canon->py" : "canon";
    const py = m("py");
    const ts = m("ts");
    const base = row === "THINK" || !(ts > py) ? "py" : "ts";
    baselines[`${row}|${model}`] = base;
    const d = paired(sc, canonArm, base);
    const mu = d.reduce((a, b) => a + b, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, d.length - 1));
    const n = MAIN_SEEDS[row];
    const mde = (2.8 * sd) / Math.sqrt(n);
    power.push({ row, model, pilotSeeds: d.length, canon: m(canonArm), py, ts, baseline: base, sd, n, mde });
    const f = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) : "–");
    rows.push(`| ${row} ${model} | ${d.length} | ${f(m(canonArm))} | ${f(py)} | ${f(ts)} | ${base} | ${sd.toFixed(3)} | ${sd > 0 ? f(mde) + " pts" : "not estimable (no pilot variance)"} |`);
  }
}
writeFileSync(join(HERE, "baselines.json"), JSON.stringify(baselines, null, 1) + "\n");
writeFileSync(join(HERE, "..", "results", "power-pilot.json"), JSON.stringify(power, null, 1) + "\n");
console.log(rows.join("\n"));
