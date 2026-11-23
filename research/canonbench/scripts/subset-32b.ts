/**
 * The exploratory Qwen2.5-Coder-32B subset (PREREGISTRATION.md amendment 1): 20 of the 60 hard
 * seeds drawn at random with a fixed seed (32); for FIX, the first matched mutant of each seed;
 * for CHANGE, the CHANGE items among those seeds; for READ (run last, if time allows), the
 * questions on those seeds. Writes items/subset-32b.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "../lib/gen.js";
import { BENCH, seedIds } from "../lib/seed.js";

const r = mulberry32(32);
const ids = seedIds().filter((id) => !id.startsWith("effects"));
for (let i = ids.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [ids[i], ids[j]] = [ids[j], ids[i]];
}
const seeds = ids.slice(0, 20).sort();
const fix = readFileSync(join(BENCH, "items", "fix.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fixItems: string[] = [];
for (const s of seeds) {
  const first = fix.find((x) => x.seed === s);
  if (first) fixItems.push(...fix.filter((x) => x.seed === s && x.mutation === first.mutation).map((x) => x.fid));
}
const change = readFileSync(join(BENCH, "items", "change.txt"), "utf8").split("\n").filter((x) => seeds.includes(x));
const read = readFileSync(join(BENCH, "items", "read.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((x) => seeds.includes(x.seed)).map((x) => x.qid);
writeFileSync(join(BENCH, "items", "subset-32b.json"), JSON.stringify({ seeds, items: [...seeds, ...fixItems, ...change, ...read] }, null, 1) + "\n");
console.log(`seeds: ${seeds.join(" ")}\nFIX items ${fixItems.length}, CHANGE ${change.length}, READ questions ${read.length}`);
