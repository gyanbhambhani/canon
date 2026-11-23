/**
 * Choose FS-1's pilot tasks: 10 tasks, 7 feature and 3 change, at least 2 adapted and 2 not,
 * drawn with a seeded shuffle. Seed 2026; if a draw breaks the adapted constraint, the seed is
 * increased by one and the draw repeated (each attempt is printed).
 *   npx tsx analysis/pilot-select.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FS1 } from "../harness/arms";

interface T { id: string; kind: string; adapted: boolean }
const tasks: T[] = readdirSync(join(FS1, "tasks")).sort().filter((d) => existsSync(join(FS1, "tasks", d, "task.json")))
  .map((d) => {
    const j = JSON.parse(readFileSync(join(FS1, "tasks", d, "task.json"), "utf8"));
    return { id: j.id, kind: j.kind, adapted: !!j.adapted };
  });

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<X>(xs: X[], r: () => number): X[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

for (let seed = 2026; ; seed++) {
  const r = mulberry32(seed);
  const pick = [...shuffle(tasks.filter((t) => t.kind === "feature"), r).slice(0, 7), ...shuffle(tasks.filter((t) => t.kind === "change"), r).slice(0, 3)];
  const adapted = pick.filter((t) => t.adapted).length;
  console.log(`seed ${seed}: ${pick.map((t) => t.id).join(", ")} (adapted ${adapted})`);
  if (adapted >= 2 && pick.length - adapted >= 2) {
    console.log(`PILOT ${pick.map((t) => t.id).join(",")}`);
    break;
  }
}
