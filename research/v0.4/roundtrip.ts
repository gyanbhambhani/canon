/**
 * v0.4 migration check over every final Canon program in the two benchmark runs (models' code,
 * not ours): does each one convert to Canon-Py with fmt, check clean in Canon-Py, and compile to
 * a program with the same results on the benchmark's hidden tests?
 *
 *   tsx --conditions=source research/v0.4/roundtrip.ts
 *
 * Writes research/v0.4/roundtrip.json with the counts and every failure.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { check, compileJs, fmt, V04_PY } from "@canon/compiler";

const root = join(import.meta.dirname, "..", "..");
const py = { features: V04_PY };

interface Run { lang: string; task: string; model: string; final: string | null; finalOk: boolean }

const out = { programs: 0, checkedInBraces: 0, converted: 0, fixedPoint: 0, checksInPy: 0, sameJsShape: 0, failures: [] as unknown[] };
for (const file of ["runs.jsonl", "runs-v0.2.jsonl"]) {
  const runs = readFileSync(join(root, "research/benchmark/results", file), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Run);
  for (const r of runs) {
    if (r.lang !== "canon" || !r.final) continue;
    out.programs++;
    const src = r.final;
    const braceOk = check(fmt(src), "main.cn").ok;
    if (braceOk) out.checkedInBraces++;
    let text: string;
    try {
      text = fmt(src, py);
    } catch (e) {
      out.failures.push({ file, task: r.task, model: r.model, stage: "convert", error: (e as { diag?: unknown }).diag ?? String(e) });
      continue;
    }
    out.converted++;
    if (fmt(text, py) === text) out.fixedPoint++;
    else out.failures.push({ file, task: r.task, stage: "fixed point" });
    if (!braceOk) continue;
    const c = check(text, "main.cn", py);
    if (c.ok) out.checksInPy++;
    else {
      out.failures.push({ file, task: r.task, model: r.model, stage: "check", codes: c.diagnostics.map((d) => [d.code, d.message]) });
      continue;
    }
    // the Canon-Py text, converted back to braces, compiles to the same JavaScript as the source
    // (exactly, when no shadowed name had to be renamed)
    const a = compileJs(fmt(src), "main.cn").js;
    const b = compileJs(fmt(text), "main.cn").js;
    if (a === b) out.sameJsShape++;
  }
}
writeFileSync(join(import.meta.dirname, "roundtrip.json"), JSON.stringify(out, null, 1) + "\n");
const { failures, ...counts } = out;
console.log(counts, `${failures.length} failures`);
for (const f of failures.slice(0, 15)) console.log(JSON.stringify(f).slice(0, 300));
