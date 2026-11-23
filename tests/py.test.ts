/**
 * v0.4: the Canon-Py corpus. tests/py/examples and tests/py/run hold every examples/ program and
 * every tests/run program in Canon-Py (written by `fmt --syntax py`). Each must:
 *  - be canonical Canon-Py and check clean with --syntax py;
 *  - stay in sync with its brace source (fmt of the brace source to Canon-Py gives this file);
 *  - convert back to braces as a fixed point (braces -> Canon-Py -> braces -> Canon-Py is stable);
 *  - behave identically: print the same output, and pass the same test blocks.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check, compileJs, fmt, readSource, V04_PY } from "@canon/compiler";
import { MemoryHost, runMain, runTests, testHost } from "@canon/runtime";

const py = { features: V04_PY };
const root = join(__dirname, "..");

function runWith(src: string, opts: typeof py | object, input: string[]) {
  const c = compileJs(src, "main.cn", opts);
  if (!c.js) throw new Error(JSON.stringify(c.check.diagnostics, null, 2));
  const mem = new MemoryHost(undefined, [...input]);
  const r = runMain(c.js, testHost(mem), {});
  return { status: r.status, trap: r.trap, error: r.error, out: mem.out.map((l) => l + "\n").join("") };
}

const sets = [
  { dir: "tests/py/examples", brace: "examples", out: (f: string) => `tests/run/example_${f.replace(/\.cn$/, ".out")}` },
  { dir: "tests/py/run", brace: "tests/run", out: (f: string) => `tests/run/${f.replace(/\.cn$/, ".out")}` },
];

describe("Canon-Py corpus", () => {
  it("holds every example and every tests/run program", () => {
    for (const s of sets) {
      const brace = readdirSync(join(root, s.brace)).filter((f) => f.endsWith(".cn")).sort();
      expect(readdirSync(join(root, s.dir)).filter((f) => f.endsWith(".cn")).sort()).toEqual(brace);
    }
  });

  for (const s of sets) {
    for (const f of readdirSync(join(root, s.dir)).filter((x) => x.endsWith(".cn")).sort()) {
      const pySrc = readSource(readFileSync(join(root, s.dir, f), "utf8"));
      const braceSrc = readSource(readFileSync(join(root, s.brace, f), "utf8"));
      it(`${s.dir}/${f}`, () => {
        const c = check(pySrc, f, py);
        expect(c.diagnostics).toEqual([]);
        expect(fmt(braceSrc, py)).toBe(pySrc);
        expect(fmt(fmt(pySrc), py)).toBe(pySrc);
        // the default (brace) mode reads Canon-Py, and gives back the brace source
        // shadowing.cn shadows names, which Canon-Py cannot spell: converting renames them (x_2)
        if (f !== "shadowing.cn") expect(fmt(pySrc)).toBe(braceSrc);
        const inFile = join(root, s.brace, f.replace(/\.cn$/, ".in"));
        const input = existsSync(inFile) ? readFileSync(inFile, "utf8").split("\n").slice(0, -1) : [];
        const a = runWith(pySrc, py, input);
        const b = runWith(braceSrc, {}, input);
        expect(a).toEqual(b);
        expect(a.out).toBe(readFileSync(join(root, s.out(f)), "utf8"));
        const ta = runTests(compileJs(pySrc, f, py).js!, testHost(new MemoryHost()));
        const tb = runTests(compileJs(braceSrc, f).js!, testHost(new MemoryHost()));
        expect(ta.map((t) => t.passed)).toEqual(tb.map((t) => t.passed));
      });
    }
  }
});
