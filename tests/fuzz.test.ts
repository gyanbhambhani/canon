/**
 * M1 acceptance: ported fuzzers from reference/test_canon.py.
 * Random whitespace plus the noisy printer (extra parens, pipeline vs calls, commas,
 * else { if }) must collapse every variant back to its canonical text, and fmt must be
 * idempotent on every variant.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { astNoise, checkFront, fmt, readSource, rng, whitespaceFuzz } from "@canon/compiler";

const dir = join(__dirname, "conformance");
// canonical sources: every corpus program the oracle accepts as canonical
const canonical = readdirSync(dir)
  .filter((f) => f.endsWith(".diag.json"))
  .filter((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).canonical)
  // v0.2: files the oracle marks canonical are canonical v0; fuzz their v0.2 canonical form
  .map((f) => ({ name: f, src: fmt(readSource(readFileSync(join(dir, f.replace(/\.diag\.json$/, ".cn")), "utf8"))) }))
  .filter((c) => c.src.length > 0);

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
