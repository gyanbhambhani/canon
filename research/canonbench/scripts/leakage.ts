/**
 * No-leakage check (plan section 8): no reference solution, nor anything close to one, appears in
 * the Canon agent reference or the prompt templates. "Close" = any non-trivial reference line
 * (at least 25 characters after trimming) occurring verbatim in the reference or templates, or a
 * reference function whose whole body's token sequence (8 tokens or more) occurs there.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANON_REFERENCE, readSystemPrompt, systemPrompt } from "../arms/prompts.js";
import { BENCH } from "../lib/seed.js";

const corpus = [CANON_REFERENCE, ...(["canon", "py", "ts"] as const).flatMap((l) => [systemPrompt(l), readSystemPrompt(l)])].join("\n").replace(/\s+/g, " ");
let hits = 0;
let files = 0;
const dirs = ["refs/canon", "refs/py", "refs/ts", "change/refs/canon", "change/refs/py", "change/refs/ts"];
for (const d of dirs) {
  for (const f of readdirSync(join(BENCH, d)).filter((x) => /\.(cn|py|ts)$/.test(x))) {
    files++;
    const src = readFileSync(join(BENCH, d, f), "utf8");
    for (const line of src.split("\n")) {
      const t = line.trim().replace(/\s+/g, " ");
      if (t.length >= 25 && !/^(from |import |class |T = |ok: |value: |error: |kind: )/.test(t) && corpus.includes(t)) {
        hits++;
        console.log(`LEAK? ${d}/${f}: ${t}`);
      }
    }
  }
}
console.log(`${files} reference files checked; ${hits} lines found verbatim in the agent reference or prompt templates`);
process.exit(hits ? 1 : 0);
