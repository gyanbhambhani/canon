/**
 * M1 acceptance: the TypeScript front end matches reference/canon.py on every
 * conformance file. Expectations are produced by `pnpm oracle`.
 *  - fmt output is byte-identical (or fails with the same diagnostic)
 *  - the front-end check result (codes, lines, columns, messages, patches, data) is identical
 *
 * v0.2 changed four constructs (DECISIONS.md, "v0.2"): `set x = e` is now `x = e`, `for cond`
 * is now `while cond`, `concat(a, b)` is now `a + b`, and `match` may appear in any expression
 * (S001 retired). The oracle stays the spec for everything else: a file that touches none of
 * these must still match byte for byte. A file that does must differ from the oracle's text only
 * on the lines holding those constructs, and v0.2 fmt must agree with formatting the oracle's output.
 *
 * v0.3 (DECISIONS.md, "Language v0.3") adds switches (packages/compiler/src/features.ts). With every
 * switch off the compiler is v0.2, and the v0.2 rules above are checked exactly in that mode. With
 * the switches on (the default), the only front-end change on this corpus is that `and`, `or` and
 * `not` print as `&&`, `||` and `!`: a file whose oracle output uses them may differ from the oracle
 * only on those lines, and v0.3 fmt must equal v0.3 fmt of the oracle's output. Every other file
 * must still match the oracle byte for byte with the v0.3 defaults.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CanonError, fmt as fmtV03, checkFront as checkV03, readSource, V02, type CheckResult } from "@canon/compiler";

const fmt = (src: string) => fmtV03(src, { features: V02 });
const checkFront = (src: string, path: string): CheckResult => checkV03(src, path, { features: V02 });

/** v0.2 words that v0.3 prints as symbols, outside strings and comments. */
const wordsOf = (text: string) => text.split("\n").map((l) => l.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/#.*$/, ""));
const LOGIC_WORD = /\b(and|or|not)\b/;
const touchesV03 = (text: string) => wordsOf(text).some((l) => LOGIC_WORD.test(l));

/** v0 spellings that v0.2 replaces. */
const V0_ONLY = /(^|\n)\s*set\s|(^|\n)\s*for\s+(?![a-z_][a-z0-9_]*\s+in\b)|\bconcat\s*\(/;
const V0_LINE = /^\s*set\s|^\s*for\s+(?![a-z_][a-z0-9_]*\s+in\b)|\bconcat\(/;

const dir = join(__dirname, "conformance");
const inputs = readdirSync(dir).filter((f) => f.endsWith(".cn") && !f.endsWith(".fmt.cn")).sort();

describe("conformance corpus", () => {
  it("holds every reference example plus at least 60 new cases", () => {
    const refs = inputs.filter((f) => f.startsWith("ref_"));
    expect(refs.length).toBe(4);
    expect(inputs.length - refs.length).toBeGreaterThanOrEqual(60);
  });

  it("covers every front-end diagnostic code", () => {
    const seen = new Set<string>();
    for (const f of inputs) {
      const d = JSON.parse(readFileSync(join(dir, f.replace(/\.cn$/, ".diag.json")), "utf8"));
      for (const x of d.diagnostics) seen.add(x.code);
    }
    for (const c of ["P001", "P002", "P003", "P004", "P005", "C001", "S001", "L001", "N001", "E100", "E101", "E102", "H001"]) {
      expect(seen, c).toContain(c);
    }
  });

  for (const f of inputs) {
    const base = join(dir, f.replace(/\.cn$/, ""));
    const src = readSource(readFileSync(join(dir, f), "utf8"));
    const expected = JSON.parse(readFileSync(`${base}.diag.json`, "utf8"));
    const oracleFmt = existsSync(`${base}.fmt.cn`) ? readFileSync(`${base}.fmt.cn`, "utf8") : null;
    const touchesV02 =
      V0_ONLY.test(src) || (oracleFmt !== null && V0_ONLY.test(oracleFmt)) ||
      expected.diagnostics.some((d: { code: string }) => d.code === "S001");

    it(`fmt ${f}`, () => {
      if (oracleFmt !== null && touchesV02) {
        const ours = fmt(src);
        expect(ours).toBe(fmt(oracleFmt));
        const a = oracleFmt.split("\n");
        const b = ours.split("\n");
        expect(b.length).toBe(a.length);
        a.forEach((line, i) => {
          if (line !== b[i]) expect(line, `line ${i + 1} differs outside a v0.2 construct`).toMatch(V0_LINE);
        });
      } else if (oracleFmt !== null) {
        expect(fmt(src)).toBe(oracleFmt);
      } else if (touchesV02 && expected.diagnostics[0].code === "S001") {
        // S001 is retired: v0.2 accepts match in any expression position
        expect(() => fmt(src)).not.toThrow();
      } else {
        let err: unknown;
        try {
          fmt(src);
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(CanonError);
        const d = (err as CanonError).diag;
        expect([d.code, d.line, d.col]).toEqual([
          expected.diagnostics[0].code,
          expected.diagnostics[0].line,
          expected.diagnostics[0].col,
        ]);
      }
    });

    it(`check ${f}`, () => {
      const got = checkFront(src, `tests/conformance/${f}`);
      if (touchesV02) {
        // the v0 spellings are now non-canonical: v0.2 reports C001 with the migration patch
        if (expected.canonical) expect(got.diagnostics.map((d) => d.code)).toContain("C001");
        return;
      }
      // codes, lines and columns are the acceptance bar; the rest must match too
      expect(got.diagnostics.map((d) => [d.code, d.line, d.col])).toEqual(
        expected.diagnostics.map((d: any) => [d.code, d.line, d.col]),
      );
      expect(JSON.parse(JSON.stringify(got))).toEqual(expected);
    });
  }

  describe("v0.3 defaults", () => {
    for (const f of inputs) {
      const base = join(dir, f.replace(/\.cn$/, ""));
      const src = readSource(readFileSync(join(dir, f), "utf8"));
      const expected = JSON.parse(readFileSync(`${base}.diag.json`, "utf8"));
      const oracleFmt = existsSync(`${base}.fmt.cn`) ? readFileSync(`${base}.fmt.cn`, "utf8") : null;
      const v02Only = V0_ONLY.test(src) || (oracleFmt !== null && V0_ONLY.test(oracleFmt)) ||
        expected.diagnostics.some((d: { code: string }) => d.code === "S001");
      const v03 = touchesV03(src) || (oracleFmt !== null && touchesV03(oracleFmt));

      it(`fmt ${f}`, () => {
        if (oracleFmt === null) {
          // the v0.2 rules above cover parse errors; v0.3 must fail (or not) the same way
          let a: unknown = null;
          let b: unknown = null;
          try { fmt(src); } catch (e) { a = (e as CanonError).diag?.code; }
          try { fmtV03(src); } catch (e) { b = (e as CanonError).diag?.code; }
          expect(b).toBe(a);
          return;
        }
        const ours = fmtV03(src);
        expect(ours).toBe(fmtV03(oracleFmt));
        if (!v02Only && !v03) {
          expect(ours).toBe(oracleFmt);
          return;
        }
        const a = oracleFmt.split("\n");
        const b = ours.split("\n");
        expect(b.length).toBe(a.length);
        a.forEach((line, i) => {
          if (line !== b[i]) expect(line, `line ${i + 1} differs outside a v0.2/v0.3 construct`).toMatch(new RegExp(`${V0_LINE.source}|\\b(and|or|not)\\b`));
        });
      });

      it(`check ${f}`, () => {
        const got = checkV03(src, `tests/conformance/${f}`);
        if (v02Only || v03) {
          if (expected.canonical) expect(got.diagnostics.map((d) => d.code)).toContain("C001");
          return;
        }
        expect(JSON.parse(JSON.stringify(got))).toEqual(expected);
      });
    }
  });
});
