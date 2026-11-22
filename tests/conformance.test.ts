/**
 * M1 acceptance: the TypeScript front end matches reference/canon.py on every
 * conformance file. Expectations are produced by `pnpm oracle`.
 *  - fmt output is byte-identical (or fails with the same diagnostic)
 *  - the front-end check result (codes, lines, columns, messages, patches, data) is identical
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CanonError, fmt, checkFront, readSource } from "@canon/compiler";

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

    it(`fmt ${f}`, () => {
      if (existsSync(`${base}.fmt.cn`)) {
        expect(fmt(src)).toBe(readFileSync(`${base}.fmt.cn`, "utf8"));
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
      // codes, lines and columns are the acceptance bar; the rest must match too
      expect(got.diagnostics.map((d) => [d.code, d.line, d.col])).toEqual(
        expected.diagnostics.map((d: any) => [d.code, d.line, d.col]),
      );
      expect(JSON.parse(JSON.stringify(got))).toEqual(expected);
    });
  }
});
