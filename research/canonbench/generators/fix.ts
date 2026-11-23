/**
 * FIX items: two bugs per seed, of matched mutation types, applied to each language's own reference.
 * Mutation types (the same pair is used in all three languages of a seed):
 *   boundary   a comparison's boundary moves: < and <=, > and >= swap
 *   operator   a wrong operator: + and -, == and !=, && and || (Python: and / or)
 *   constant   off by one: an integer literal n becomes n + 1 (or n - 1)
 * Sites inside string literals, comments and the required declarations are never mutated.
 * A mutant is kept only if it still passes its language's checker (a logic bug, not a type error)
 * and fails at least one hidden test. The failing example shown to the model is the first failing
 * hidden test. The plan's "wrong field", "swapped arguments", "missing case", "missing or
 * undeclared side effect" and "wrong error branch" types are not generated (see DECISIONS.md).
 * Writes items/fix.jsonl.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTests } from "../adapters/exec.js";
import { checkCode } from "../arms/check.js";
import { mulberry32, type Rnd } from "../lib/gen.js";
import { BENCH, LANGS, loadRef, loadSeed, loadTests, seedIds, type Lang } from "../lib/seed.js";
import { pyDecls } from "../lib/types.js";

type MType = "boundary" | "operator" | "constant";
const TYPES: MType[] = ["boundary", "operator", "constant"];

export interface FixItem {
  fid: string;
  seed: string;
  lang: Lang;
  mutation: MType;
  site: { line: number; from: string; to: string };
  broken: string;
  fail: { args: unknown[]; expected: unknown; actual: unknown; error?: string };
  checkerOutput: string;
}

/** Spans that must not be mutated: string literals and comments. */
function masked(src: string, lang: Lang): boolean[] {
  const m = new Array(src.length).fill(false);
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if ((lang !== "py" && two === "//") || (lang === "py" && c === "#")) {
      while (i < src.length && src[i] !== "\n") m[i++] = true;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      if (lang === "canon" && c !== '"') {
        i++;
        continue;
      }
      const q = c;
      const triple = lang === "py" && src.slice(i, i + 3) === q.repeat(3);
      const end = triple ? q.repeat(3) : q;
      m[i++] = true;
      if (triple) m[i++] = m[i++] = true;
      while (i < src.length && src.slice(i, i + end.length) !== end) {
        if (src[i] === "\\") m[i++] = true;
        m[i++] = true;
      }
      for (let k = 0; k < end.length && i < src.length; k++) m[i++] = true;
      continue;
    }
    i++;
  }
  return m;
}

interface Site {
  start: number;
  end: number;
  to: string;
}

function sites(src: string, lang: Lang, type: MType, protectUntil: number, r: Rnd): Site[] {
  const m = masked(src, lang);
  const out: Site[] = [];
  const add = (re: RegExp, to: (s: string) => string | null) => {
    for (const x of src.matchAll(re)) {
      const start = x.index! + (x[0].length - x[0].trimStart().length);
      const tok = x[0].trim();
      const end = start + tok.length;
      if (start < protectUntil || m[start]) continue;
      const t = to(tok);
      if (t !== null) out.push({ start, end, to: t });
    }
  };
  if (type === "boundary") {
    add(/ (<=|>=|<|>) /g, (t) => ({ "<": "<=", "<=": "<", ">": ">=", ">=": ">" })[t] ?? null);
  } else if (type === "operator") {
    add(/ (\+|-|==|!=) /g, (t) => ({ "+": "-", "-": "+", "==": "!=", "!=": "==" })[t] ?? null);
    if (lang === "py") add(/ (and|or) /g, (t) => (t === "and" ? "or" : "and"));
    else add(/ (&&|\|\|) /g, (t) => (t === "&&" ? "||" : "&&"));
  } else {
    add(/(?<![\w.])\d+(?![\w.])/g, (t) => {
      const n = Number(t);
      return String(n === 0 || r() < 0.5 ? n + 1 : n - 1);
    });
  }
  return out;
}

function shuffle<T>(xs: T[], r: Rnd): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mutant(id: string, lang: Lang, type: MType, salt: number): FixItem | null {
  const seed = loadSeed(id);
  const src = loadRef(lang, id)!;
  const decl = lang === "canon" ? seed.decls.canon : lang === "ts" ? seed.decls.ts : pyDecls(seed).trim();
  const r = mulberry32(1000 + salt);
  const cases = loadTests(id);
  for (const s of shuffle(sites(src, lang, type, decl ? decl.length : 0, r), r).slice(0, 12)) {
    const broken = src.slice(0, s.start) + s.to + src.slice(s.end);
    const c = checkCode(lang, broken);
    if (!c.ok) continue;
    const t = runTests(lang, broken, seed, cases);
    if (t.passed === t.total || !t.firstFail) continue;
    if (t.crashed === t.total && /time limit|timed out|Script execution timed out|CallTimeout/i.test(t.firstFail.error ?? "")) continue;
    const line = src.slice(0, s.start).split("\n").length;
    return {
      fid: `${id}.${type}.${lang}`,
      seed: id,
      lang,
      mutation: type,
      site: { line, from: src.slice(s.start, s.end), to: s.to },
      broken,
      fail: t.firstFail,
      checkerOutput: "",
    };
  }
  return null;
}

const items: FixItem[] = [];
const droppedSeeds: string[] = [];
seedIds().forEach((id, k) => {
  const r = mulberry32(77 + k);
  const order = shuffle(TYPES, r);
  const got: FixItem[][] = [];
  for (const type of order) {
    if (got.length === 2) break;
    const ms = LANGS.map((l, li) => mutant(id, l, type, k * 10 + li));
    if (ms.every((x) => x)) got.push(ms as FixItem[]);
  }
  if (got.length < 2) droppedSeeds.push(`${id}(${got.length})`);
  for (const g of got) items.push(...g);
  process.stdout.write(`${id}: ${got.map((g) => g[0].mutation).join(",")}\n`);
});
writeFileSync(join(BENCH, "items", "fix.jsonl"), items.map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(`FIX: ${items.length} items (${items.length / 3} per language); seeds with fewer than 2 matched mutants: ${droppedSeeds.join(" ")}`);
