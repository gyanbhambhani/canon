/**
 * Canon v0.3 acceptance (docs/v0.3-proposal.md). Every v0.3 feature has a switch, and each
 * test below also checks that turning the switch off restores v0.2 behaviour.
 */
import { describe, expect, it } from "vitest";
import { applyPatch, check, fix, fmt, V02, type Diagnostic } from "@canon/compiler";
import { fuzzContracts, MemoryHost, runMain, runTests, testHost } from "@canon/runtime";
import { compileOrThrow, run, test } from "./helpers/run";

const codes = (src: string, opts = {}) => check(src, "main.cn", opts).diagnostics.map((d) => d.code);
const ok = (src: string) => expect(check(src).diagnostics).toEqual([]);

describe("self-healing toolchain: fix()", () => {
  // first drafts that failed in the v0.2 benchmark (research/benchmark/results/runs-v0.2.jsonl)
  const nestedThree = `fn reverse_words(s: String) -> String {
  return join(reverse(split(s, " ")), " ")
}
`;
  const parens = `fn tri(k: Int) -> Int {
  return (k / 2) * (k + 1)
}
`;
  const longList = `fn checks(name: String, age: Int, email: String) -> List[(Bool, String)] {
  return [(name == "", "name is empty"), (age < 0 || age > 150, "age out of range"), (email == "", "email is empty")]
}
`;
  const missingEffect = `fn greet(name: String) -> Unit {
  print(name)
}
`;
  const mixed = `fn half(n: Int) -> Float {
  return n * 0.5
}
`;

  it("applies C001, E101, E102 and T009 patches to a fixed point", () => {
    for (const src of [nestedThree, parens, missingEffect, mixed]) {
      expect(codes(src).length).toBeGreaterThan(0);
      const r = fix(src);
      expect(r.result.diagnostics).toEqual([]);
      expect(r.result.ok).toBe(true);
      expect(r.applied.length).toBeGreaterThan(0);
      expect(check(r.source).ok).toBe(true);
    }
  });

  it("reports which codes it fixed, in order", () => {
    const r = fix(missingEffect.replace("print(name)", "print(name)\n\n\n"));
    expect(r.applied).toEqual(["C001", "E101"]);
  });

  it("leaves judgment errors to the agent", () => {
    const src = "fn f(n: Int) -> String {\n  return n\n}\n";
    const r = fix(src);
    expect(r.source).toBe(src);
    expect(r.result.diagnostics.map((d) => d.code)).toEqual(["T001"]);
  });

  it("never applies the T004 patch (it inserts holes, which are questions)", () => {
    const src = "fn f(o: Option[Int]) -> Int {\n  return match o {\n    Some(x) => x,\n  }\n}\n";
    expect(fix(src).result.diagnostics.map((d) => d.code)).toEqual(["T004"]);
  });

  it("does nothing on a canonical program", () => {
    const r = fix(nestedThree.replace("return join(reverse(split(s, \" \")), \" \")", "return s"));
    expect(r.applied).toEqual([]);
  });

  it("wraps an over-long line, so L001 becomes mechanical", () => {
    expect(codes(longList)).toContain("C001");
    const r = fix(longList);
    expect(r.result.diagnostics).toEqual([]);
    expect(r.source).toContain("  return [\n    (name == \"\", \"name is empty\"),\n");
  });
});

describe("canonical line wrapping (switch: wrap)", () => {
  const long = `fn f(a: Int) -> List[String] {
  return [to_string(a), to_string(a + 1), to_string(a + 2), to_string(a + 3), to_string(a + 4), "xyz"]
}
`;
  it("breaks the outermost bracket one item per line, with trailing commas", () => {
    const out = fmt(long);
    expect(out).toBe(`fn f(a: Int) -> List[String] {
  return [
    to_string(a),
    to_string(a + 1),
    to_string(a + 2),
    to_string(a + 3),
    to_string(a + 4),
    "xyz",
  ]
}
`);
    expect(fmt(out)).toBe(out);
    expect(check(out).diagnostics).toEqual([]);
  });

  it("wraps call arguments and record literals too", () => {
    const src = `type P {
  first_name: String,
  last_name: String,
  email_address: String,
}

fn mk(s: String) -> P {
  return P { first_name: s + "aaaaaaaaaa", last_name: s + "bbbbbbbbbbbb", email_address: s + "cccccccccc" }
}
`;
    const out = fmt(src);
    expect(out).toContain("  return P {\n    first_name: s + \"aaaaaaaaaa\",\n");
    expect(fmt(out)).toBe(out);
    expect(check(out).ok).toBe(true);
  });

  it("is off with --no-wrap: v0.2 keeps the long line and reports L001", () => {
    expect(fmt(long, { features: { wrap: false } })).toBe(fmt(fmt(long), { features: { wrap: false } }));
    expect(codes(fmt(long, { features: { wrap: false } }), { features: { wrap: false } })).toEqual(["L001"]);
  });

  it("does not wrap lines that fit", () => {
    const short = "fn f(a: Int) -> List[Int] {\n  return [a, a]\n}\n";
    expect(fmt(short)).toBe(short);
  });
});

describe("break (switch: break)", () => {
  const src = `fn first_negative(xs: List[Int]) -> Int {
  var found = 0
  for x in xs {
    if x < 0 {
      found = x
      break
    }
  }
  return found
}

fn main() -> Unit
  effects: io
{
  let n = first_negative([3, -2, -7])
  print(to_string(n))
  var i = 0
  while true {
    i = i + 1
    if i == 4 {
      break
    }
  }
  print(to_string(i))
}
`;
  it("exits the innermost loop", () => {
    ok(src);
    expect(run(src).stdout).toBe("-2\n4\n");
  });

  it("outside a loop is T010", () => {
    expect(codes("fn f() -> Unit {\n  break\n}\n")).toEqual(["T010"]);
    expect(codes("fn f(xs: List[Int]) -> List[Int] {\n  return map(xs, |x| x)\n}\n")).toEqual([]);
  });

  it("is not available with --no-break", () => {
    expect(codes(src, { features: { break: false } })).toEqual(["P004"]);
  });

  it("break is still usable as an ordinary name", () => {
    ok("fn f(break: Int) -> Int {\n  return break + 1\n}\n");
  });
});

describe("for-loop destructuring (switch: destructure)", () => {
  const src = `fn first_index(xs: List[String], want: String) -> Int {
  for (i, x) in enumerate(xs) {
    if x == want {
      return i
    }
  }
  return -1
}

fn main() -> Unit
  effects: io
{
  let i = first_index(["a", "b", "c"], "c")
  print(to_string(i))
  for (k, v) in zip(["x", "y"], [1, 2]) {
    print(k + to_string(v))
  }
}
`;
  it("binds each tuple slot to a name", () => {
    ok(src);
    expect(run(src).stdout).toBe("2\nx1\ny2\n");
  });

  it("checks the arity against the element type", () => {
    const bad = "fn f(xs: List[Int]) -> Int {\n  for (a, b) in enumerate(xs) {\n    return a\n  }\n  return 0\n}\n";
    expect(codes(bad)).toEqual([]);
    const wrong = "fn f(xs: List[Int]) -> Int {\n  for (a, b) in xs {\n    return a\n  }\n  return 0\n}\n";
    expect(codes(wrong)).toEqual(["T001"]);
  });

  it("is a parse error with --no-destructure", () => {
    expect(codes(src, { features: { destructure: false } })[0]).toBe("P001");
  });
});

describe("&&, || and ! (switch: symbols)", () => {
  it("fmt rewrites the v0.2 words to symbols", () => {
    const v02 = "fn f(a: Bool, b: Bool, c: Bool) -> Bool {\n  return a and not b or c\n}\n";
    expect(fmt(v02)).toBe("fn f(a: Bool, b: Bool, c: Bool) -> Bool {\n  return a && !b || c\n}\n");
  });

  it("keeps the meaning when the old `not` covered a comparison", () => {
    const v02 = "fn f(a: Int, b: Int) -> Bool {\n  return not a == b\n}\n";
    const out = fmt(v02);
    expect(out).toBe("fn f(a: Int, b: Int) -> Bool {\n  return !(a == b)\n}\n");
    expect(fmt(out)).toBe(out);
  });

  it("! binds tighter than comparison, as in TypeScript and Rust", () => {
    const src = "fn f(a: Bool, b: Bool) -> Bool {\n  return !a == b\n}\n";
    ok(src);
    const js = compileOrThrow(src + "\nfn main() -> Unit\n  effects: io\n{\n  print(to_string(f(true, false)))\n}\n");
    const mem = new MemoryHost();
    runMain(js, testHost(mem));
    expect(mem.out).toEqual(["true"]);
  });

  it("== true and == false still collapse", () => {
    expect(fmt("fn f(a: Bool) -> Bool {\n  return a == false\n}\n")).toBe("fn f(a: Bool) -> Bool {\n  return !a\n}\n");
    expect(fmt("fn f(a: Bool) -> Bool {\n  return !!a\n}\n")).toBe("fn f(a: Bool) -> Bool {\n  return a\n}\n");
  });

  it("|| at the start of an expression is still a lambda with no parameters", () => {
    ok("fn f() -> fn() -> Int {\n  return || 1\n}\n");
  });

  it("with --no-symbols fmt prints the v0.2 words", () => {
    const src = "fn f(a: Bool, b: Bool) -> Bool {\n  return a && !b\n}\n";
    expect(fmt(src, { features: { symbols: false } })).toBe("fn f(a: Bool, b: Bool) -> Bool {\n  return a and not b\n}\n");
  });
});

describe("effect-checked tests (switch: sealedEffects)", () => {
  const fsTest = `test "reads a file" {
  let r = read_file("x.txt")
  assert(r == r)
}
`;
  it("a test that touches fs without declaring it is E101, with a patch", () => {
    const d = check(fsTest).diagnostics;
    expect(d.map((x) => x.code)).toEqual(["E101"]);
    const patched = applyPatch(fsTest, d[0].fix!.diff);
    expect(patched).toContain('test "reads a file"\n  effects: fs\n{');
    ok(patched!);
  });

  it("io, time and rand need no declaration (the test host makes them deterministic)", () => {
    ok(`test "prints" {\n  print("hi")\n  sleep(5)\n  assert(now() == 5)\n  assert(random() < 1.0)\n}\n`);
  });

  it("declaring an effect a test does not need is E102", () => {
    expect(codes(`test "t"\n  effects: io\n{\n  print("x")\n}\n`)).toEqual(["E102"]);
  });

  it("at run time a test may use only the fs and net it declares", () => {
    const declared = `test "w"\n  effects: fs\n{\n  let r = write_file("a", "b")\n  assert(r == r)\n}\n`;
    expect(test(declared)[0]).toMatchObject({ passed: true });
    // compiled with the switch off, the undeclared test runs but the host denies fs
    expect(check(fsTest, "main.cn", { features: { sealedEffects: false } }).ok).toBe(true);
    const js = compileOrThrow(fsTest, { features: { sealedEffects: false } });
    const out = runTests(js, testHost(new MemoryHost()), { capabilityGuard: true });
    expect(out[0]).toMatchObject({ passed: false, trap: { code: "R006" } });
  });

  it("with --no-sealed-effects, tests are unchecked as in v0.2", () => {
    expect(codes(fsTest, { features: { sealedEffects: false } })).toEqual([]);
  });
});

describe("runtime capability guard", () => {
  it("canon run allows only the effects main declares", () => {
    const src = "fn main() -> Unit\n  effects: io\n{\n  print(\"ok\")\n}\n";
    expect(run(src, { capabilityGuard: true }).stdout).toBe("ok\n");
  });
});

describe("ranked suggestions for judgment errors (switch: suggestions)", () => {
  const sugg = (src: string, opts = {}): { label: string; diff: string }[] => {
    const d = check(src, "main.cn", opts).diagnostics.find((x: Diagnostic) => x.code === "T001")!;
    return ((d.data ?? {}) as { suggestions?: { label: string; diff: string }[] }).suggestions ?? [];
  };

  it("Int where a String is expected: to_string", () => {
    const src = "fn f(n: Int) -> String {\n  return n\n}\n";
    const s = sugg(src);
    expect(s[0].label).toBe("to_string(n)");
    ok(applyPatch(src, s[0].diff)!);
  });

  it("Option[T] where T is expected: unwrap_or with a hole, then match", () => {
    const src = "fn f(xs: List[Int]) -> Int {\n  return first(xs)\n}\n";
    const s = sugg(src);
    expect(s.map((x) => x.label)[0]).toBe("unwrap_or(first(xs), ?)");
    expect(check(applyPatch(src, s[0].diff)!).diagnostics.map((d) => d.code)).toEqual(["H001"]);
  });

  it("T where Option[T] or Result[T, E] is expected: Some / Ok", () => {
    expect(sugg("fn f(n: Int) -> Option[Int] {\n  return n\n}\n")[0].label).toBe("Some(n)");
    expect(sugg("fn f(n: Int) -> Result[Int, String] {\n  return n\n}\n")[0].label).toBe("Ok(n)");
  });

  it("are absent with --no-suggestions", () => {
    expect(sugg("fn f(n: Int) -> String {\n  return n\n}\n", { features: { suggestions: false } })).toEqual([]);
  });
});

describe("v0.2 compatibility", () => {
  it("every v0.3 switch off is exactly v0.2", () => {
    const src = "fn f(a: Bool) -> Bool {\n  return a and not a\n}\n";
    expect(fmt(src, { features: V02 })).toBe(src);
    expect(codes(src, { features: V02 })).toEqual([]);
  });

  it("fmt migrates a v0.2 program to v0.3", () => {
    const v02 = "fn f(xs: List[Int]) -> Bool {\n  var seen = false\n  for x in xs {\n    if x > 0 and not seen {\n      seen = true\n    }\n  }\n  return seen\n}\n";
    expect(codes(v02)).toEqual(["C001"]);
    ok(fmt(v02));
  });
});

describe("contract fuzzing (switch: --no-contract-fuzz)", () => {
  const fuzz = (src: string) => fuzzContracts(compileOrThrow(src), testHost(new MemoryHost()));

  it("finds an input that breaks ensures, and shows it", () => {
    const src = "fn abs_diff(a: Int, b: Int) -> Int\n  ensures: result >= 0\n{\n  return a - b\n}\n";
    const [r] = fuzz(src);
    expect(r).toMatchObject({ name: "fuzz abs_diff", passed: false, counterexample: { trap: { code: "R002" } } });
    expect(r.counterexample!.args[0]).toMatch(/^a = -?\d+$/);
  });

  it("discards inputs that fail requires, and passes a correct contract", () => {
    const src = "fn halve(n: Int) -> Int\n  requires: n % 2 == 0\n  ensures: result * 2 == n\n{\n  return n / 2\n}\n";
    const [r] = fuzz(src);
    expect(r.passed).toBe(true);
    expect(r.discarded).toBeGreaterThan(0);
    expect(r.runs).toBeGreaterThan(0);
  });

  it("reports a trap that the contract did not rule out (division by zero)", () => {
    const src = "fn per(total: Int, n: Int) -> Int\n  requires: n >= 0\n{\n  return total / n\n}\n";
    expect(fuzz(src)[0]).toMatchObject({ passed: false, counterexample: { trap: { code: "R004" } } });
  });

  it("generates records, sum types, lists and options, deterministically", () => {
    const src = `type Op =
  | Deposit(amount: Int)
  | Withdraw(amount: Int)

type Acct {
  owner: String,
  ops: List[Op],
}

fn total(a: Acct, extra: Option[Int]) -> Int
  ensures: result >= 0
{
  var t = unwrap_or(extra, 0)
  for op in a.ops {
    t = t + (match op {
      Deposit(x) => x,
      Withdraw(x) => -x,
    })
  }
  return t
}
`;
    const a = fuzz(src);
    expect(a[0].passed).toBe(false);
    expect(fuzz(src)).toEqual(a);
  });

  it("skips functions without contracts, with effects, or with function parameters", () => {
    const src = "fn f(n: Int) -> Int {\n  return n\n}\n\nfn g(h: fn(Int) -> Int) -> Int\n  ensures: result == result\n{\n  return h(1)\n}\n";
    expect(fuzz(src)).toEqual([expect.objectContaining({ fn: "g", skipped: "a function-typed parameter", passed: true })]);
  });
});
