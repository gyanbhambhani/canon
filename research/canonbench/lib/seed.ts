/** Seeds, hidden tests and references on disk. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BENCH = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = join(BENCH, "..", "..");

/** "cpy" is the exploratory Canon-Py arm (amendment 2): Canon in its Python-shaped surface. */
export type Lang = "canon" | "py" | "ts" | "cpy";
export const LANGS: Lang[] = ["canon", "py", "ts"];
export const EXT: Record<Lang, string> = { canon: "cn", py: "py", ts: "ts", cpy: "cn" };

export interface Case {
  args: unknown[];
  expected: unknown;
}

export interface Seed {
  id: string;
  source: string;
  fn: string;
  params: [string, string][];
  ret: string;
  desc: string;
  examples: Case[];
  decls: { canon: string; ts: string };
  typeKinds: Record<string, "record" | "sum">;
  tags: string[];
}

export function seedIds(): string[] {
  return readdirSync(join(BENCH, "seeds"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

export const loadSeed = (id: string): Seed => JSON.parse(readFileSync(join(BENCH, "seeds", `${id}.json`), "utf8"));
export const loadTests = (id: string): Case[] => JSON.parse(readFileSync(join(BENCH, "tests", `${id}.json`), "utf8")).cases;
export const loadTestsFrom = (dir: string, id: string): Case[] => JSON.parse(readFileSync(join(BENCH, dir, `${id}.json`), "utf8")).cases;

export function loadRef(lang: Lang, id: string, dir = "refs"): string | null {
  const f = join(BENCH, dir, lang, `${id}.${EXT[lang]}`);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}
