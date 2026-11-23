/**
 * M2 acceptance: the type checker.
 *  - every program in tests/types/pass checks clean (front end + types)
 *  - every program in tests/types/fail reports its expected code first among its errors
 *  - the T004 and T009 patches apply with the system patch tool
 *  - H001 reports expected types for holes in lets, arguments, returns and match arms
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check, readSource } from "@canon/compiler";

const dir = join(__dirname, "types");
const files = (sub: string) => readdirSync(join(dir, sub)).filter((f) => f.endsWith(".cn")).sort();
const read = (sub: string, f: string) => readSource(readFileSync(join(dir, sub, f), "utf8"));

export function applyPatch(src: string, diff: string): string {
  const d = mkdtempSync(join(tmpdir(), "canon-patch-"));
  writeFileSync(join(d, "main.cn"), src);
  writeFileSync(join(d, "fix.diff"), diff);
  const p = spawnSync("patch", ["-p1", "-i", "fix.diff"], { cwd: d, encoding: "utf8" });
  if (p.status !== 0) throw new Error(p.stdout + p.stderr);
  return readFileSync(join(d, "main.cn"), "utf8");
}

describe("types/pass", () => {
  const pass = files("pass");
  it("has at least 40 programs", () => expect(pass.length).toBeGreaterThanOrEqual(40));
  for (const f of pass) {
    it(f, () => {
      const r = check(read("pass", f), f);
      expect(r.diagnostics).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }
});

describe("types/fail", () => {
  const fail = files("fail");
  it("has at least 30 programs covering T001-T009 and M001", () => {
    expect(fail.length).toBeGreaterThanOrEqual(30);
    const codes = new Set(fail.map((f) => /# expect: (\w+)/.exec(read("fail", f))![1]));
    for (const c of ["T001", "T002", "T003", "T004", "T005", "T006", "T007", "T008", "T009", "M001"]) {
      expect(codes, c).toContain(c);
    }
  });
  for (const f of fail) {
    it(f, () => {
      const src = read("fail", f);
      const want = /# expect: (\w+)/.exec(src)![1];
      const r = check(src, f);
      expect(r.ok).toBe(false);
      expect(r.canonical).toBe(true);
      expect(r.diagnostics[0]?.code, JSON.stringify(r.diagnostics, null, 2)).toBe(want);
    });
  }
});

describe("patches", () => {
  it("T004 patch applies and the result reports only H001 holes", () => {
    for (const f of ["t004_sum.cn", "t004_option.cn", "t004_bool.cn", "t004_int_no_wild.cn", "t004_nested.cn"]) {
      const src = read("fail", f);
      const d = check(src, "main.cn").diagnostics.find((x) => x.code === "T004")!;
      expect(d.fix?.kind, f).toBe("patch");
      const fixed = applyPatch(src, d.fix!.diff);
      const after = check(fixed, "main.cn").diagnostics;
      expect(after.length, f).toBeGreaterThan(0);
      expect(after.map((x) => x.code), `${f}\n${fixed}`).toEqual(after.map(() => "H001"));
      for (const h of after) expect((h.data as any).expected, f).not.toBeNull();
    }
  });

  it("T009 patch applies and the patched file passes", () => {
    for (const f of ["t009_mixed.cn", "t009_compare.cn"]) {
      const src = read("fail", f);
      const d = check(src, "main.cn").diagnostics.find((x) => x.code === "T009")!;
      const fixed = applyPatch(src, d.fix!.diff);
      expect(check(fixed, "main.cn").diagnostics, fixed).toEqual([]);
    }
  });

  it("E101 patch from the full checker applies and passes", () => {
    const src = read("fail", "e101_full_table.cn");
    const d = check(src, "main.cn").diagnostics[0];
    expect(check(applyPatch(src, d.fix!.diff), "main.cn").diagnostics).toEqual([]);
  });
});

describe("holes", () => {
  const hole = (src: string) => check(src, "main.cn").diagnostics.filter((d) => d.code === "H001");

  it("in a let binding", () => {
    const h = hole("fn f() -> Int {\n  let x = ?thing\n  return x + 1\n}\n");
    expect(h).toHaveLength(1);
    expect((h[0].data as any).expected).toBe("Int");
  });

  it("in a call argument, with candidates", () => {
    const h = hole("fn half(x: Float) -> Float {\n  return x / 2.0\n}\n\nfn f() -> Float {\n  return half(?)\n}\n");
    expect((h[0].data as any).expected).toBe("Float");
    expect((h[0].data as any).candidates).toEqual(["half(x: Float) -> Float"]);
  });

  it("in a built-in call argument", () => {
    const h = hole("fn f() -> Int {\n  return len(?xs)\n}\n");
    expect((h[0].data as any).expected).toMatch(/^List\[/);
  });

  it("in a return", () => {
    const h = hole("fn total(xs: List[Int]) -> Int {\n  return sum(xs)\n}\n\nfn f(xs: List[Int]) -> Int {\n  return ?best\n}\n");
    expect(h[0].message).toBe("hole ?best in fn f: needs a value of type Int");
    expect((h[0].data as any).candidates).toEqual(["total(xs: List[Int]) -> Int"]);
  });

  it("in a match arm", () => {
    const h = hole("fn f(o: Option[Int]) -> String {\n  return match o {\n    Some(n) => ?,\n    None => \"none\",\n  }\n}\n");
    expect((h[0].data as any).expected).toBe("String");
  });

  it("anywhere in an expression", () => {
    const h = hole("fn f(a: Bool) -> Bool {\n  return a and ?cond\n}\n");
    expect((h[0].data as any).expected).toBe("Bool");
  });
});

describe("robustness", () => {
  it("check never throws on any conformance or type-corpus file", () => {
    const corpus = join(__dirname, "conformance");
    const all = [
      ...readdirSync(corpus).filter((f) => f.endsWith(".cn")).map((f) => join(corpus, f)),
      ...files("pass").map((f) => join(dir, "pass", f)),
      ...files("fail").map((f) => join(dir, "fail", f)),
    ];
    for (const f of all) {
      const r = check(readSource(readFileSync(f, "utf8")), f);
      expect(Array.isArray(r.diagnostics), f).toBe(true);
    }
  });
});

describe("method-style calls", () => {
  it("say there are no methods", () => {
    const d = check(read("fail", "t002_method_call.cn"), "main.cn").diagnostics[0];
    expect(d.message).toContain("Canon has no methods; call len(xs, ...) instead");
  });
});

describe("v0.2 constructs", () => {
  const ok = (src: string) => expect(check(src, "main.cn").diagnostics, src).toEqual([]);
  const codes = (src: string) => check(src, "main.cn").diagnostics.map((d) => d.code);

  it("plain assignment mutates a var, and is still T006 on a let", () => {
    ok("fn f() -> Int {\n  var x = 1\n  x = x + 1\n  return x\n}\n");
    expect(codes("fn f() -> Int {\n  let x = 1\n  x = 2\n  return x\n}\n")).toEqual(["T006"]);
  });

  it("field assignment updates a var record", () => {
    ok("type P {\n  x: Int,\n}\n\nfn f(p: P) -> P {\n  var q = p\n  q.x = 3\n  return q\n}\n");
  });

  it("while is the condition loop", () => {
    ok("fn f(n: Int) -> Int {\n  var i = 0\n  while i < n {\n    i = i + 1\n  }\n  return i\n}\n");
  });

  it("+ joins strings, and still refuses to mix types", () => {
    ok('fn f(a: String, n: Int) -> String {\n  return a + " has " + to_string(n)\n}\n');
    expect(codes('fn f(a: String, n: Int) -> String {\n  return a + n\n}\n')).toContain("T001");
  });

  it("match is allowed in any expression position", () => {
    // as an operand (here an if condition) a match is parenthesized in canonical form
    ok("fn f(o: Option[Int], b: Int) -> Bool {\n  if (match o {\n    Some(v) => v > b,\n    None => false,\n  }) {\n    return true\n  }\n  return false\n}\n");
  });

  it("v0 spellings still parse and format to v0.2 (C001 with the migration patch)", async () => {
    const { fmt } = await import("@canon/compiler");
    const v0 = 'fn f(n: Int) -> String {\n  var i = 0\n  for i < n {\n    set i = i + 1\n  }\n  return concat("n=", to_string(i))\n}\n';
    expect(fmt(v0)).toBe('fn f(n: Int) -> String {\n  var i = 0\n  while i < n {\n    i = i + 1\n  }\n  return "n=" + to_string(i)\n}\n');
    expect(codes(v0)).toEqual(["C001"]);
  });
});
