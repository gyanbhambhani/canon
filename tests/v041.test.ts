/**
 * v0.4.1: the six follow-ups from the v0.4 review (DECISIONS.md, 2026-11-22).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, check, compileJs, fmt, V02, V04_PY } from "@canon/compiler";
import { MemoryHost, fuzzContracts, runMain, testHost } from "@canon/runtime";

const root = join(__dirname, "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const canon = (args: string[]) => {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const file = (name: string, text: string) => {
  const p = join(mkdtempSync(join(tmpdir(), "canon-v041-")), name);
  writeFileSync(p, text);
  return p;
};
const output = (src: string, opts = {}) => {
  const c = compileJs(fmt(src, opts), "main.cn", opts);
  if (!c.js) throw new Error(JSON.stringify(c.check.diagnostics));
  const mem = new MemoryHost();
  runMain(c.js, testHost(mem), {});
  return mem.out.join("\n");
};

describe("v0.4.1", () => {
  it("a to_float fix never keeps an integer division's truncation", () => {
    const mean = "fn mean(xs: List[Int]) -> Float {\n  return sum(xs) / len(xs)\n}\n";
    const t001 = check(mean).diagnostics.find((d) => d.code === "T001")!;
    const sug = (t001.data as { suggestions: { label: string; diff: string }[] }).suggestions;
    expect(sug[0].label).toBe("to_float(sum(xs)) / to_float(len(xs))");

    const scaled = "fn mean(xs: List[Int]) -> Float {\n  return sum(xs) / len(xs) * 1.0\n}\n";
    const t009 = check(scaled).diagnostics.find((d) => d.code === "T009")!;
    const fixed = applyPatch(scaled, t009.fix!.diff);
    expect(fixed).toContain("to_float(sum(xs)) / to_float(len(xs)) * 1.0");
    const run = fixed + '\nfn main() -> Unit\n  effects: io\n{\n  print(to_string(mean([1, 2])))\n}\n';
    expect(output(run)).toBe("1.5");

    // no division: wrapping the whole Int expression is exact, and stays as before
    const plain = "fn f(a: Int, b: Int) -> Float {\n  return a + b\n}\n";
    const s2 = (check(plain).diagnostics[0].data as { suggestions: { label: string }[] }).suggestions;
    expect(s2[0].label).toBe("to_float(a + b)");
  });

  it("the chained-comparison P001 names && (and the v0.2 mode keeps 'and')", () => {
    const src = "fn f(a: Int, b: Int, c: Int) -> Bool {\n  return a < b < c\n}\n";
    expect(check(src).diagnostics[0].message).toContain("use '&&'");
    expect(check(src, "main.cn", { features: V02 }).diagnostics[0].message).toContain("use 'and'");
    const pySrc = "def f(a: int, b: int, c: int) -> bool:\n    return a < b < c\n";
    expect(check(pySrc, "main.cn", { features: V04_PY }).diagnostics[0].message).toContain("use 'and'");
  });

  it("text output lists T001 suggestions; --json keeps their diffs", () => {
    const p = file("m.cn", "fn mean(xs: List[Int]) -> Float {\n  return sum(xs) / len(xs)\n}\n");
    const r = canon(["check", p]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("  did you mean (patches in --json):\n    to_float(sum(xs)) / to_float(len(xs))\n");
    const j = JSON.parse(canon(["check", p, "--json"]).out);
    expect(j.diagnostics[0].data.suggestions[0].diff).toMatch(/^--- a\//);
  });

  it("contract functions that are not fuzzed are reported and counted as skips", () => {
    const src = [
      "fn never(n: Int) -> Int\n  requires: n > 1000000\n{\n  return n\n}\n",
      "fn shout(n: Int) -> Int\n  requires: n > 0\n  effects: io\n{\n  print(to_string(n))\n  return n\n}\n",
      "fn ident[T](x: T) -> T\n  ensures: result == x\n{\n  return x\n}\n",
      "fn half(n: Int) -> Int\n  requires: n >= 0\n{\n  return n / 2\n}\n",
    ].join("\n");
    const js = compileJs(fmt(src)).js!;
    const out = fuzzContracts(js, testHost(new MemoryHost()));
    expect(out.map((z) => [z.fn, z.skipped ?? "ran"])).toEqual([
      ["never", "all 200 generated inputs failed requires"],
      ["shout", "performs effects: io"],
      ["ident", "a generic function"],
      ["half", "ran"],
    ]);
    const p = file("z.cn", fmt(src));
    const t = canon(["test", p]);
    expect(t.code).toBe(0);
    expect(t.out).toContain("SKIP fuzz never (all 200 generated inputs failed requires)\n");
    expect(t.out.trim().split("\n").at(-1)).toBe("1 passed, 0 failed, 3 skipped");
    expect(JSON.parse(canon(["test", p, "--json"]).out)).toMatchObject({ ok: true, passed: 1, skipped: 3 });
  });

  it("a long pipeline stage breaks its arguments when that makes every line fit", () => {
    const long = "|acc, x| acc + x * 1000000 + 1000000 * x + 999999 * x + 1234567 + x * 7654321 + 1111111";
    const src = `fn f(xs: List[Int]) -> String {\n  return xs |> map(|x| x * 2) |> fold(0, ${long}) |> to_string()\n}\n`;
    const out = fmt(src);
    expect(out).toBe(
      "fn f(xs: List[Int]) -> String {\n  return xs\n    |> map(|x| x * 2)\n    |> fold(\n      0,\n" +
      `      ${long},\n    )\n    |> to_string()\n}\n`,
    );
    expect(fmt(out)).toBe(out);
    expect(check(out).diagnostics).toEqual([]);
    // too long even on its own line: left alone, L001
    const huge = "fn f(xs: List[Int]) -> List[Int] {\n  return xs\n    |> map(|x| x * 1000000 + 1000000 * x + 999999 * x + 888888 * x + 777777 * x + 6666666 * x + 5555555 * x)\n    |> filter(|x| x > 0)\n    |> filter(|x| x > 1)\n}\n";
    expect(fmt(huge)).toBe(huge);
    expect(check(huge).diagnostics.map((d) => d.code)).toEqual(["L001"]);
    // --no-wrap keeps v0.2 behaviour
    expect(fmt(src, { features: { wrap: false } })).not.toContain("fold(\n");
  });

  it("Canon-Py programs print values in Python spelling; brace programs are unchanged", () => {
    const brace = 'type Item {\n  sku: String,\n  qty: Int,\n}\n\nfn main() -> Unit\n  effects: io\n{\n  print(to_string(1 < 2))\n  print(to_string(Item { sku: "a", qty: 1 }))\n  print(to_string([Some(false), None]))\n}\n';
    expect(output(brace)).toBe('true\nItem { sku: "a", qty: 1 }\n[Some(false), None]');
    const pySrc = fmt(brace, { features: V04_PY });
    expect(output(pySrc, { features: V04_PY })).toBe('True\nItem(sku="a", qty=1)\n[Some(False), None]');
    // and the next brace program is back to brace spelling
    expect(output(brace)).toBe('true\nItem { sku: "a", qty: 1 }\n[Some(false), None]');
  });
});
