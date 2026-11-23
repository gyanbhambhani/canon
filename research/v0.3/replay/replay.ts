/**
 * Retrospective replay (no model calls): take every Canon first draft from the two benchmark runs
 * (research/benchmark/results, read only), and ask what `canon check --fix` would have done to it.
 *
 *   first-pass valid, as recorded           the draft checked clean under its language version
 *   valid after --fix (v0.2 language)        fix() with every v0.3 language switch off
 *   valid after --fix (v0.3 language)        fix() with v0.3 defaults
 *   hidden tests after --fix                 the fixed draft passes every hidden test of its task
 *
 * The v0 run's drafts are v0 programs; v0.2 and v0.3 both migrate them with fmt (C001), so their
 * replay is reported for completeness but the v0.2 run is the one that matters.
 *
 *   npx tsx --conditions=source research/v0.3/replay/replay.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fix, V02 } from "@canon/compiler";
import { canon } from "../../benchmark/src/languages.js";
import { TASKS } from "../../benchmark/src/tasks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, "..", "..", "benchmark", "results");

interface Run {
  model: string;
  lang: string;
  task: string;
  fallback: boolean;
  firstPassOk: boolean;
  firstCodes: string[];
  initial: string;
}

const out: Record<string, unknown> = {};
const lines: string[] = [];
for (const file of ["runs.jsonl", "runs-v0.2.jsonl"]) {
  const runs: Run[] = readFileSync(join(RESULTS, file), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((r: Run) => !r.fallback && r.lang === "canon");
  for (const model of [...new Set(runs.map((r) => r.model))].sort()) {
    const rs = runs.filter((r) => r.model === model);
    const failed = rs.filter((r) => !r.firstPassOk);
    const row = { file, model, runs: rs.length, firstPass: rs.length - failed.length, fixedV02: 0, fixedV03: 0, passTestsV03: 0, residual: [] as string[][] };
    for (const r of failed) {
      const a = fix(r.initial, "main.cn", { features: V02 });
      if (a.result.ok) row.fixedV02++;
      const b = fix(r.initial, "main.cn");
      if (b.result.ok) {
        row.fixedV03++;
        const task = TASKS.find((t) => t.id === r.task)!;
        const t = canon.test(b.source, task);
        if (t.passed === t.total) row.passTestsV03++;
      } else {
        row.residual.push(b.result.diagnostics.map((d) => d.code));
      }
    }
    // a clean v0.2 draft must stay clean (and keep passing) after the v0.3 fix loop
    let regressions = 0;
    for (const r of rs.filter((x) => x.firstPassOk)) if (!fix(r.initial, "main.cn").result.ok) regressions++;
    out[`${file}|${model}`] = { ...row, regressions };
    const pct = (n: number) => `${((100 * n) / rs.length).toFixed(1)}%`;
    lines.push(
      `| ${file === "runs.jsonl" ? "v0" : "v0.2"} | ${model} | ${rs.length} | ${pct(row.firstPass)} | ${pct(row.firstPass + row.fixedV02)} | ` +
        `${pct(row.firstPass + row.fixedV03)} | ${row.passTestsV03} of ${row.fixedV03} | ${regressions} |`,
    );
  }
}
const table = [
  "| Run | Model | Canon runs | First-pass valid (recorded) | Valid after `--fix`, v0.2 language | Valid after `--fix`, v0.3 | Fixed drafts passing all hidden tests | Clean drafts broken by v0.3 `--fix` |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...lines,
].join("\n");
console.log(table);
writeFileSync(join(HERE, "replay.json"), JSON.stringify(out, null, 2) + "\n");
writeFileSync(join(HERE, "TABLE.md"), table + "\n");
