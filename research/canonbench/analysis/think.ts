/**
 * THINK, single programs (target: Python). Derived from the WRITE runs, with no extra model calls:
 *   py          Direct: the WRITE Python run (same prompt, same toolchain); thinkPass = its pass
 *   canon->py   Through Canon: the WRITE Canon run's final program, compiled with the shipped
 *               Python generator (generateFastapi -> logic.py, what `canon build` writes for a
 *               project with no api fn) and run against the same hidden tests in Python
 * A Canon program that does not check, or that the generator refuses (G00x), fails.
 * Writes results/think-<model>[-tag].jsonl.
 *
 *   npx tsx --conditions=source analysis/think.ts --tag main
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compile, runTests } from "../adapters/exec.js";
import { BENCH, loadSeed, loadTests } from "../lib/seed.js";

const i = process.argv.indexOf("--tag");
const tag = i >= 0 ? process.argv[i + 1] : "main";
for (const model of ["qwen7b", "opus", "gpt"]) {
  const f = join(BENCH, "results", `write-${model}${tag === "main" ? "" : "-" + tag}.jsonl`);
  if (!existsSync(f)) continue;
  const out: string[] = [];
  let jsPassPyFail = 0;
  let buildRefused = 0;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    if (r.arm === "py") {
      out.push(JSON.stringify({ ...r, key: r.key.replace("|write|", "|think|"), family: "think", arm: "py", thinkPass: r.pass, final: undefined, initial: undefined }));
    } else if (r.arm === "canon") {
      const seed = loadSeed(r.seed);
      let thinkPass = false;
      let note = "";
      if (r.tests) {
        const c = compile("canonpy", r.final);
        if (!c.ok) {
          note = c.error ?? "build failed";
          buildRefused++;
        } else {
          const t = runTests("canonpy", r.final, seed, loadTests(r.seed), { compiled: c });
          thinkPass = t.passed === t.total;
          note = `${t.passed}/${t.total}`;
        }
        if (r.pass && !thinkPass) jsPassPyFail++;
      } else note = "never checked clean";
      out.push(JSON.stringify({ ...r, key: r.key.replace("|write|", "|think|").replace("|canon|", "|canon->py|"), family: "think", arm: "canon->py", thinkPass, thinkNote: note, initial: undefined }));
    }
  }
  writeFileSync(join(BENCH, "results", `think-${model}${tag === "main" ? "" : "-" + tag}.jsonl`), out.join("\n") + "\n");
  console.log(`${model}: ${out.length} THINK records; Canon programs passing on the JS runtime but failing after compiling to Python: ${jsPassPyFail}; generator refused: ${buildRefused}`);
}
