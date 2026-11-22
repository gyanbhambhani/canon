/** Cross-checks the Python-compat helpers against a real python3 on random inputs. */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { pyFloatRepr, pyRepr, pySplitlines, unifiedDiff } from "@canon/compiler";

function python(script: string, input: unknown): any {
  const r = spawnSync("python3", ["-I", "-c", script], { input: JSON.stringify(input), encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

describe("python compatibility", () => {
  it("unifiedDiff matches difflib.unified_diff", () => {
    const vocab = ["a\n", "b\n", "c\n", "  x\n", "}\n", "{\n", "\n", "fn f() -> Int {\n", "end"];
    const cases: [string[], string[]][] = [];
    for (let k = 0; k < 300; k++) {
      const big = k % 50 === 0;
      const mk = () => Array.from({ length: Math.floor(rand() * (big ? 400 : 25)) }, () => vocab[Math.floor(rand() * vocab.length)]);
      cases.push([mk(), mk()]);
    }
    const expected = python(
      "import sys,json,difflib\nprint(json.dumps(['' .join(difflib.unified_diff(a,b,'a/x.cn','b/x.cn')) for a,b in json.load(sys.stdin)]))",
      cases,
    );
    cases.forEach(([a, b], i) => expect(unifiedDiff(a, b, "a/x.cn", "b/x.cn")).toBe(expected[i]));
  });

  it("pyFloatRepr matches repr(float)", () => {
    const xs: number[] = [0.1, 1e16, 1.5e16, 1e-5, 1e-4, 123456789.123, 1e22, 5e-324, 1.7976931348623157e308, 9999999999999998];
    for (let k = 0; k < 2000; k++) {
      const e = Math.floor(rand() * 40) - 20;
      xs.push(Number((rand() * 10).toPrecision(1 + Math.floor(rand() * 17))) * 10 ** e);
    }
    const expected = python("import sys,json\nprint(json.dumps([repr(float(x)) for x in json.load(sys.stdin)]))", xs.map(String));
    xs.forEach((x, i) => expect(pyFloatRepr(x)).toBe(expected[i]));
  });

  it("pyRepr and pySplitlines match", () => {
    const strs = ["a", "it's", "\"q\"", "both ' and \"", "tab\tnew\nline", "\x01\x7f", "é", "a\rb\r\nc d\x0c", ""];
    const expected = python(
      "import sys,json\nxs=json.load(sys.stdin)\nprint(json.dumps([[repr(x), x.splitlines(), x.splitlines(True)] for x in xs]))",
      strs,
    );
    strs.forEach((s, i) => {
      expect(pyRepr(s)).toBe(expected[i][0]);
      expect(pySplitlines(s)).toEqual(expected[i][1]);
      expect(pySplitlines(s, true)).toEqual(expected[i][2]);
    });
  });
});
