/**
 * M1 acceptance: ported fuzzers from reference/test_canon.py.
 * Random whitespace plus the noisy printer (extra parens, pipeline vs calls, commas,
 * else { if }) must collapse every variant back to its canonical text, and fmt must be
 * idempotent on every variant.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFront, fmt, lex, normalize, parse, Printer, readSource, type Tok } from "@canon/compiler";

const dir = join(__dirname, "conformance");
// canonical sources: every corpus program the oracle accepts as canonical
const canonical = readdirSync(dir)
  .filter((f) => f.endsWith(".diag.json"))
  .filter((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).canonical)
  .map((f) => ({ name: f, src: readSource(readFileSync(join(dir, f.replace(/\.diag\.json$/, ".cn")), "utf8")) }))
  .filter((c) => c.src.length > 0);

/** mulberry32: small seeded PRNG */
export function rng(seed: number) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random,
    int: (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1)),
    choice: <T>(xs: T[]) => xs[Math.floor(random() * xs.length)],
  };
}

type Rng = ReturnType<typeof rng>;

function whitespaceFuzz(src: string, r: Rng): string {
  const toks: Tok[] = lex(src);
  const out: string[] = [];
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i];
    const nxt = toks[i + 1];
    out.push(t.text);
    if (t.kind === "comment") out.push("\n".repeat(r.int(1, 3)));
    else if (nxt.kind === "op" && nxt.text === "(") {
      if (nxt.line === t.line) out.push(r.choice(["", " ", "  ", "\t"]));
      else out.push(r.choice(["\n", "\n\n", " \n    "]));
    } else out.push(r.choice([" ", "  ", "\n", "\t", " \n    ", "\n\n"]));
  }
  return out.join("");
}

function astNoise(src: string, r: Rng): string {
  return new Printer(r).program(normalize(parse(src)));
}

const TOTAL = 5000;

describe("fuzz", () => {
  it(`collapses ${TOTAL} structural variants to their canonical texts`, () => {
    expect(canonical.length).toBeGreaterThanOrEqual(40);
    const r = rng(7);
    let failures = 0;
    const per = Math.ceil(TOTAL / canonical.length);
    let total = 0;
    let distinct = 0;
    for (const { name, src } of canonical) {
      const seen = new Set<string>();
      for (let k = 0; k < per; k++) {
        const variant = whitespaceFuzz(astNoise(src, r), r);
        seen.add(variant);
        const out = fmt(variant);
        if (out !== src) {
          failures++;
          if (failures < 3) expect.soft(out, `${name} variant:\n${variant}`).toBe(src);
        }
        if (variant !== src) {
          const c = checkFront(variant, "main.cn");
          if (c.canonical || c.diagnostics[0]?.code !== "C001") failures++;
        }
        total++;
      }
      distinct += seen.size;
    }
    expect(total).toBeGreaterThanOrEqual(TOTAL);
    expect(distinct).toBeGreaterThan(TOTAL / 2);
    expect(failures).toBe(0);
  });

  it("fmt is idempotent on every fuzzed variant", () => {
    const r = rng(11);
    let n = 0;
    for (const { src } of canonical) {
      for (let k = 0; k < 40; k++) {
        const once = fmt(whitespaceFuzz(astNoise(src, r), r));
        expect(fmt(once)).toBe(once);
        n++;
      }
    }
    expect(n).toBeGreaterThan(1000);
  });
});
