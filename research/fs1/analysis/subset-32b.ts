/** The 20 tasks Qwen2.5-Coder-32B runs (exploratory): the first 20 of all 60 task ids, shuffled with seed 2032. */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FS1 } from "../harness/arms";

const ids = readdirSync(join(FS1, "tasks")).filter((d) => existsSync(join(FS1, "tasks", d, "task.json"))).sort();
let a = 2032 >>> 0;
const r = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
for (let i = ids.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [ids[i], ids[j]] = [ids[j], ids[i]];
}
console.log(ids.slice(0, 20).join(","));
