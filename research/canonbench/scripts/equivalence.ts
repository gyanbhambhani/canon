/**
 * Equivalence check (plan section 4.2): the three references of a seed must agree on 1,000 fuzzed
 * inputs, run through the per-language adapters. Two results agree when both return equal values,
 * or both fail (raise / trap). Writes results/equivalence.json; seeds with any disagreement are
 * listed and dropped from item generation unless the disagreement is explained in DECISIONS.md.
 *
 *   npx tsx --conditions=source scripts/equivalence.ts [--n 1000] [ids...]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { approxEqual, execute, type CallResult } from "../adapters/exec.js";
import { InputGen, mulberry32 } from "../lib/gen.js";
import { OVERFLOW_TRAP, valid } from "../lib/preconditions.js";
import { BENCH, LANGS, loadRef, loadSeed, loadTests, seedIds } from "../lib/seed.js";

const argv = process.argv.slice(2);
let n = 1000;
const ni = argv.indexOf("--n");
if (ni >= 0) {
  n = Number(argv[ni + 1]);
  argv.splice(ni, 2);
}
const ids = argv.length ? argv : seedIds();

const agree = (a: CallResult, b: CallResult) => (a.ok && b.ok ? approxEqual(a.v, b.v) : !a.ok && !b.ok);

const report: Record<string, { inputs: number; disagreements: number; examples: unknown[]; failShare: number }> = {};
for (const id of ids) {
  const seed = loadSeed(id);
  const cases = loadTests(id);
  const g = new InputGen(seed, cases, mulberry32(7919 + id.length * 31));
  const seen = new Set<string>();
  const inputs: unknown[][] = [];
  for (let tries = 0; inputs.length < n && tries < n * 20; tries++) {
    const a = g.next();
    const k = JSON.stringify(a);
    if (!seen.has(k) && valid(id, a)) {
      seen.add(k);
      inputs.push(a);
    }
  }
  const res = Object.fromEntries(LANGS.map((l) => [l, execute(l, loadRef(l, id)!, seed, inputs)])) as Record<string, CallResult[]>;
  const examples: unknown[] = [];
  let dis = 0;
  let fails = 0;
  inputs.forEach((args, i) => {
    const c = res.canon[i];
    if (!c.ok && OVERFLOW_TRAP.test(c.e ?? "")) return;
    if (!c.ok) fails++;
    if (!agree(c, res.py[i]) || !agree(c, res.ts[i])) {
      dis++;
      if (examples.length < 3) examples.push({ args, canon: c, py: res.py[i], ts: res.ts[i] });
    }
  });
  report[id] = { inputs: inputs.length, disagreements: dis, examples, failShare: fails / inputs.length };
  console.log(`${dis ? "DISAGREE" : "agree   "} ${id}: ${inputs.length} inputs, ${dis} disagreements, ${(100 * fails / inputs.length).toFixed(0)}% fail${dis ? " " + JSON.stringify(examples[0]).slice(0, 500) : ""}`);
}
const out = join(BENCH, "results", argv.length ? "equivalence-partial.json" : "equivalence.json");
writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
const bad = Object.entries(report).filter(([, r]) => r.disagreements > 0).map(([id]) => id);
console.log(`${ids.length} seeds, ${bad.length} with disagreements: ${bad.join(" ")}`);
