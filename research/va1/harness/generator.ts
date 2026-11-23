/**
 * VA-1's near-boundary input generator, the same for every arm.
 *
 * Every input starts from a *valid* input (`base`, drawn at random per sample) and is one of:
 *   base            the valid input itself
 *   inside:<rule>   one field or relation moved to the *edge* of a rule, still valid
 *   outside:<rule>  one field or relation moved just past the edge of a rule (the smallest amount)
 *   random          every field drawn independently from a wide range (mostly invalid)
 *
 * A task's task.json declares the draws (base, random) and, per rule, the inside and outside
 * mutations. A value that is a string starting with "=" is an expression, evaluated with
 *   $name              the field's value in the base input (in `base`, `random`: earlier fields)
 *   int(a, b)          integer in [a, b]            float(a, b)   a number with two decimals in [a, b]
 *   pick([..])         one of the array's items     alnum(n)      n random letters and digits
 *   rep(s, n)          s repeated n times           chance(p)     true with probability p
 *   emoji(n)           n astral characters (one code point, two UTF-16 units each)
 * Any other value is a constant. A mutation is { "set": { field: value } }: every field not named
 * keeps its base value, so a mutation changes exactly the named fields.
 */

export interface Mutation {
  set: Record<string, unknown>;
}

export interface Rule {
  id: string;
  /** "single": one field and a fixed constraint (a schema can state it); "cross": two or more fields or a computation */
  kind: "single" | "cross";
  desc: string;
  inside: Mutation[];
  outside: Mutation[];
}

export interface GenSpec {
  id: string;
  base: Record<string, unknown>;
  random: Record<string, unknown>;
  rules: Rule[];
}

export interface Sample {
  input: Record<string, unknown>;
  category: string;
  /** the fields this sample changed from its base (empty for base and random) */
  changed: string[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

function helpers(rand: () => number) {
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  return {
    int,
    float: (a: number, b: number) => Math.round((a + rand() * (b - a)) * 100) / 100,
    pick: <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)],
    alnum: (n: number) => Array.from({ length: n }, () => ALNUM[int(0, ALNUM.length - 1)]).join(""),
    rep: (s: string, n: number) => s.repeat(Math.max(0, n)),
    chance: (p: number) => rand() < p,
    emoji: (n: number) => "\u{1F600}".repeat(Math.max(0, n)),
  };
}

const compiled = new Map<string, (v: Record<string, unknown>, h: ReturnType<typeof helpers>) => unknown>();

/** Evaluate a draw or mutation value: constants as they are, "=expr" strings as expressions. */
export function evalValue(value: unknown, v: Record<string, unknown>, rand: () => number): unknown {
  if (typeof value !== "string" || !value.startsWith("=")) return value;
  let fn = compiled.get(value);
  if (!fn) {
    const body = value.slice(1).replace(/\$([A-Za-z_]\w*)/g, "v.$1");
    const made = new Function("v", "h", `const {int, float, pick, alnum, rep, chance, emoji} = h; return (${body});`) as unknown as NonNullable<typeof fn>;
    compiled.set(value, made);
    fn = made;
  }
  return fn(v, helpers(rand));
}

function draw(spec: Record<string, unknown>, rand: () => number, fallback?: Record<string, unknown>): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const name of Object.keys(fallback ?? spec)) v[name] = evalValue(name in spec ? spec[name] : fallback![name], v, rand);
  return v;
}

/** `n` seeded samples for a task: 10% base, 20% inside, 50% outside, 20% random. */
export function generate(spec: GenSpec, seed: number, n = 1000): Sample[] {
  const rand = mulberry32(seed ^ hashString(spec.id));
  const out: Sample[] = [];
  const inside = spec.rules.flatMap((r) => r.inside.map((m) => ({ r, m })));
  const outside = spec.rules.flatMap((r) => r.outside.map((m) => ({ r, m })));
  // outside samples cycle through the rules first, then through each rule's variants, so every rule gets its share
  const byRule = spec.rules.filter((r) => r.outside.length);
  const insideByRule = spec.rules.filter((r) => r.inside.length);
  let io = 0;
  let ii = 0;
  for (let i = 0; i < n; i++) {
    const base = draw(spec.base, rand);
    const slot = i % 10;
    if (slot === 0 || (!inside.length && slot < 3) || (!outside.length && slot < 8)) {
      out.push({ input: base, category: "base", changed: [] });
    } else if (slot < 3 && inside.length) {
      const r = insideByRule[ii++ % insideByRule.length];
      const m = r.inside[Math.floor(rand() * r.inside.length)];
      out.push(mutate(base, m, `inside:${r.id}`, rand));
    } else if (slot < 8 && outside.length) {
      const r = byRule[io++ % byRule.length];
      const m = r.outside[Math.floor(rand() * r.outside.length)];
      out.push(mutate(base, m, `outside:${r.id}`, rand));
    } else {
      out.push({ input: draw(spec.random, rand, spec.base), category: "random", changed: [] });
    }
  }
  return out;
}

function mutate(base: Record<string, unknown>, m: Mutation, category: string, rand: () => number): Sample {
  const input = { ...base };
  for (const [k, val] of Object.entries(m.set)) input[k] = evalValue(val, base, rand);
  return { input, category, changed: Object.keys(m.set) };
}
