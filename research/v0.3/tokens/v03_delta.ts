/**
 * Programs before and after v0.3 formatting, for token counting (v03_delta.py counts them with the
 * Qwen2.5-Coder tokenizer). Corpora: examples/, tests/run/, and every final Canon program of the
 * v0.2 benchmark (research/benchmark/results/runs-v0.2.jsonl, read only).
 *
 *   npx tsx --conditions=source research/v0.3/tokens/v03_delta.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fmt, V02 } from "@canon/compiler";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const pairs: { corpus: string; id: string; v02: string; v03: string }[] = [];
const add = (corpus: string, id: string, src: string) => {
  const v02 = fmt(src, { features: V02 });
  pairs.push({ corpus, id, v02, v03: fmt(src) });
};
for (const d of ["examples", "tests/run"]) {
  for (const f of readdirSync(join(ROOT, d)).filter((x) => x.endsWith(".cn"))) add(d, f, readFileSync(join(ROOT, d, f), "utf8"));
}
for (const line of readFileSync(join(ROOT, "research/benchmark/results/runs-v0.2.jsonl"), "utf8").split("\n").filter(Boolean)) {
  const r = JSON.parse(line);
  if (r.lang === "canon" && !r.fallback) add("benchmark-v0.2", r.key, r.final);
}
writeFileSync(join(HERE, "v03_pairs.json"), JSON.stringify(pairs));
const changed = pairs.filter((p) => p.v02 !== p.v03).length;
console.log(`${pairs.length} programs, ${changed} change under v0.3 fmt`);
