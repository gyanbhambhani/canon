/**
 * v0.4 acceptance: the Canon-Py front end (docs/v0.4-design.md).
 *  - every canonical spelling, and the brace text it corresponds to
 *  - lenient forms collapse to the canonical one (C001 with a patch that applies)
 *  - Python forms with no Canon meaning are rejected with a message naming the Canon form
 *  - binding inference, parameter updates, block scope
 *  - diagnostics and patches speak Canon-Py
 *  - fuzzing: noisy variants of every corpus program collapse to their canonical text
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, CanonError, check, compileJs, fmt, readSource, V04_PY, type Diagnostic } from "@canon/compiler";
import { MemoryHost, runMain, runTests, testHost } from "@canon/runtime";

const py = { features: V04_PY };
const pyFmt = (s: string) => fmt(s, py);
const codes = (s: string) => check(s, "main.cn", py).diagnostics.map((d) => d.code);
const diags = (s: string): Diagnostic[] => check(s, "main.cn", py).diagnostics;
function parseError(s: string): Diagnostic {
  try {
    pyFmt(s);
  } catch (e) {
    if (e instanceof CanonError) return e.diag;
    throw e;
  }
  throw new Error("expected a parse error:\n" + s);
}
function run(s: string): string {
  const c = compileJs(s, "main.cn", py);
  if (!c.js) throw new Error(JSON.stringify(c.check.diagnostics, null, 2));
  const mem = new MemoryHost();
  const r = runMain(c.js, testHost(mem), {});
  if (r.trap) throw new Error(JSON.stringify(r.trap));
  return mem.out.join("\n");
}

describe("Canon-Py: canonical spellings", () => {
  // [Canon-Py, brace syntax] pairs: each is a fixed point in its surface and they convert both ways
  const pairs: [string, string][] = [
    ["def f(x: int) -> int:\n    return x + 1\n", "fn f(x: Int) -> Int {\n  return x + 1\n}\n"],
    [
      "def f(xs: list[str], m: dict[str, int], t: tuple[int, float]) -> Option[bool]:\n    return None\n",
      "fn f(xs: List[String], m: Map[String, Int], t: (Int, Float)) -> Option[Bool] {\n  return None\n}\n",
    ],
    ["def apply(f: Callable[[int], int], x: int) -> int:\n    return f(x)\n", "fn apply(f: fn(Int) -> Int, x: Int) -> Int {\n  return f(x)\n}\n"],
    [
      "@effects(io)\ndef each(xs: list[str], f: Callable[[str], None, io]) -> None:\n    for x in xs:\n        f(x)\n",
      "fn each(xs: List[String], f: fn(String) -> Unit effects: io) -> Unit\n  effects: io\n{\n  for x in xs {\n    f(x)\n  }\n}\n",
    ],
    [
      "@requires(n >= 0)\n@ensures(result >= 1)\ndef fact(n: int) -> int:\n    if n == 0:\n        return 1\n    return n * fact(n - 1)\n",
      "fn fact(n: Int) -> Int\n  requires: n >= 0\n  ensures: result >= 1\n{\n  if n == 0 {\n    return 1\n  }\n  return n * fact(n - 1)\n}\n",
    ],
    ["class Item:\n    sku: str\n    qty: int\n", "type Item {\n  sku: String,\n  qty: Int,\n}\n"],
    ["class Box[T]:\n    value: T\n", "type Box[T] {\n  value: T,\n}\n"],
    ["type Op = Deposit(amount: int) | Withdraw(amount: int) | Reset\n", "type Op =\n  | Deposit(amount: Int)\n  | Withdraw(amount: Int)\n  | Reset\n"],
    [
      "def g(a: bool, b: bool, c: bool) -> bool:\n    return a and not b or c\n",
      "fn g(a: Bool, b: Bool, c: Bool) -> Bool {\n  return a && !b || c\n}\n",
    ],
    [
      "def g(xs: list[int], x: int) -> bool:\n    return x in xs and x not in [1, 2]\n",
      "fn g(xs: List[Int], x: Int) -> Bool {\n  return contains(xs, x) && !contains([1, 2], x)\n}\n",
    ],
    ["def g(o: Option[int]) -> bool:\n    return o is None or o is not None\n", "fn g(o: Option[Int]) -> Bool {\n  return o == None || o != None\n}\n"],
    ["def g(t: tuple[int, str]) -> str:\n    return t[1]\n", "fn g(t: (Int, String)) -> String {\n  return t.1\n}\n"],
    ["def g(n: int) -> str:\n    return f\"n = {n}, next {n + 1}\"\n", 'fn g(n: Int) -> String {\n  return "n = " + to_string(n) + ", next " + to_string(n + 1)\n}\n'],
    ['def g(n: int) -> str:\n    return "even" if n % 2 == 0 else "odd"\n', 'fn g(n: Int) -> String {\n  return match n % 2 == 0 {\n    true => "even",\n    false => "odd",\n  }\n}\n'],
    ["def g(xs: list[int]) -> list[int]:\n    return map(xs, lambda x: x * 2)\n", "fn g(xs: List[Int]) -> List[Int] {\n  return map(xs, |x| x * 2)\n}\n"],
    [
      "def g(s: str) -> Result[int, str]:\n    n = parse(s)?\n    return Ok(n)\n\ndef parse(s: str) -> Result[int, str]:\n    return Err(s)\n",
      "fn g(s: String) -> Result[Int, String] {\n  let n = try parse(s)\n  return Ok(n)\n}\n\nfn parse(s: String) -> Result[Int, String] {\n  return Err(s)\n}\n",
    ],
    [
      "def total(xs: list[int]) -> int:\n    t = 0\n    for x in xs:\n        t += x\n    return t\n",
      "fn total(xs: List[Int]) -> Int {\n  var t = 0\n  for x in xs {\n    t = t + x\n  }\n  return t\n}\n",
    ],
    [
      "def digits(n: int) -> int:\n    c = 0\n    while n > 0:\n        n /= 10\n        c += 1\n    return c\n",
      "fn digits(n: Int) -> Int {\n  var n = n\n  var c = 0\n  while n > 0 {\n    n = n / 10\n    c = c + 1\n  }\n  return c\n}\n",
    ],
    [
      "def area(s: Shape) -> float:\n    match s:\n        case Circle(r):\n            return 3.0 * r * r\n        case _:\n            return 0.0\n",
      "fn area(s: Shape) -> Float {\n  return match s {\n    Circle(r) => 3.0 * r * r,\n    _ => 0.0,\n  }\n}\n",
    ],
    [
      "def k(o: Option[int]) -> int:\n    match o:\n        case Some(n):\n            v = n\n        case None:\n            v = 0\n    return v\n",
      "fn k(o: Option[Int]) -> Int {\n  let v = match o {\n    Some(n) => n,\n    None => 0,\n  }\n  return v\n}\n",
    ],
    [
      "def walk(xs: list[str]) -> None:\n    for i, x in enumerate(xs):\n        if i > 2:\n            break\n        elif x == \"\":\n            pass\n        else:\n            assert x != \"?\"\n",
      "fn walk(xs: List[String]) -> Unit {\n  for (i, x) in enumerate(xs) {\n    if i > 2 {\n      break\n    } else if x == \"\" {} else {\n      assert(x != \"?\")\n    }\n  }\n}\n",
    ],
    ['def test_adds_two() -> None:\n    assert 1 + 1 == 2\n', 'test "adds two" {\n  assert(1 + 1 == 2)\n}\n'],
    ["import std.text\n\n# a comment\ndef g() -> int:\n    return ...\n", "use std.text\n\n# a comment\nfn g() -> Int {\n  return ?\n}\n"],
  ];
  for (const [p, b] of pairs) {
    it(p.split("\n")[0], () => {
      expect(pyFmt(p)).toBe(p);
      expect(fmt(p)).toBe(b);
      expect(pyFmt(b)).toBe(p);
    });
  }
});

describe("Canon-Py: lenient forms collapse to one text", () => {
  const cases: [string, string][] = [
    ["def f() -> str:\n    return 'it\\'s \"q\"'\n", 'def f() -> str:\n    return "it\'s \\"q\\""\n'],
    ["def f(x: int) -> int:\n    y = x\n    y = y + 1\n    return y\n", "def f(x: int) -> int:\n    y = x\n    y += 1\n    return y\n"],
    ['def f(n: int) -> str:\n    return "n=" + to_string(n)\n', 'def f(n: int) -> str:\n    return f"n={n}"\n'],
    ["def f(xs: list[int]) -> bool:\n    return contains(xs, 3)\n", "def f(xs: list[int]) -> bool:\n    return 3 in xs\n"],
    ["def f(o: Option[int]) -> bool:\n    return o == None\n", "def f(o: Option[int]) -> bool:\n    return o is None\n"],
    ["@dataclass\nclass P:\n    x: int\n", "class P:\n    x: int\n"],
    ["def f(a: bool) -> int:\n    if a:\n        return 1\n    else:\n        if not a:\n            return 2\n    return 3\n", "def f(a: bool) -> int:\n    if a:\n        return 1\n    elif not a:\n        return 2\n    return 3\n"],
    ["def f(x: int) -> int:\n    pass\n    return ((x))\n", "def f(x: int) -> int:\n    return x\n"],
    ["def f(x: int) -> list[int]:\n    return [x, x,]\n", "def f(x: int) -> list[int]:\n    return [x, x]\n"],
    ["def f(x: int) -> int:\n  if x > 0: return 1\n  return 0\n", "def f(x: int) -> int:\n    if x > 0:\n        return 1\n    return 0\n"],
    ["def f(xs: list[int]) -> int:\n    return xs |> map(lambda x: x) |> filter(lambda x: x > 0) |> len()\n", "def f(xs: list[int]) -> int:\n    return len(filter(map(xs, lambda x: x), lambda x: x > 0))\n"],
    ["def f(c: bool) -> int:\n    match c:\n        case True:\n            return 1\n        case False:\n            return 2\n", "def f(c: bool) -> int:\n    return 1 if c else 2\n"],
    ["def f(c: bool) -> int:\n    match c:\n        case False:\n            return 2\n        case _:\n            return 1\n", "def f(c: bool) -> int:\n    return 1 if c else 2\n"],
    ["def f(a: bool, b: bool) -> bool:\n    return a && !b\n", "def f(a: bool, b: bool) -> bool:\n    return a and not b\n"],
    ["def f(t: tuple[int, int]) -> int:\n    return t.0\n", "def f(t: tuple[int, int]) -> int:\n    return t[0]\n"],
    ["def f() -> int:\n    return ?best\n", "def f() -> int:\n    return ...\n"],
    ["def f() -> int:\n    return 1\n\n\n\ndef g() -> int:\n    return 2\n", "def f() -> int:\n    return 1\n\ndef g() -> int:\n    return 2\n"],
    ["def f(x: int) -> bool:\n    return x == True\n", "def f(x: int) -> bool:\n    return x\n"],
  ];
  for (const [messy, canonical] of cases) {
    it(messy.split("\n").slice(-2, -1)[0].trim() || messy.split("\n")[0], () => {
      expect(pyFmt(messy)).toBe(canonical);
      const d = diags(messy).find((x) => x.code === "C001")!;
      expect(d, JSON.stringify(diags(messy))).toBeDefined();
      expect(applyPatch(messy, d.fix!.diff)).toBe(canonical);
    });
  }
});

describe("Canon-Py: Python forms with no Canon meaning are rejected, naming the Canon form", () => {
  const head = "def f(xs: list[int], s: str, n: int) -> int:\n";
  const bad: [string, string, RegExp][] = [
    ["indexing", head + "    return xs[n]\n", /no indexing/],
    ["continue", head + "    for x in xs:\n        continue\n    return 0\n", /no continue/],
    ["exceptions", head + "    try:\n        return 1\n    except:\n        return 2\n", /no exceptions/],
    ["raise", head + "    raise ValueError()\n", /no exceptions/],
    ["floor division", head + "    return n // 2\n", /no \/\//],
    ["power", head + "    return n ** 2\n", /pow/],
    ["comprehension", head + "    return sum([x for x in xs])\n", /comprehensions/],
    ["dict literal", head + "    m = {}\n    return 0\n", /map_from/],
    ["multi-statement case", head + "    match n:\n        case 1:\n            y = 2\n            return y\n        case _:\n            return 0\n", /exactly one statement/],
    ["case guard", head + "    match n:\n        case k if k > 0:\n            return 1\n        case _:\n            return 0\n", /guards/],
    ["mixed case endings", head + "    match n:\n        case 1:\n            return 1\n        case _:\n            print(\"x\")\n", /end the same way/],
    ["keyword arguments", head + "    return max(a=1, b=2)\n", /keyword arguments/],
    ["local annotation", head + "    y: int = 1\n    return y\n", /annotations/],
    ["missing return type", "def f(n: int):\n    return n\n", /return type/],
    ["untyped parameter", "def f(n) -> int:\n    return n\n", /needs a type/],
    ["default argument", "def f(n: int = 1) -> int:\n    return n\n", /default arguments/],
    ["docstring", 'def f() -> int:\n    """doc"""\n    return 1\n', /docstrings/],
    ["tabs", "def f() -> int:\n\treturn 1\n", /tabs/],
    ["chained comparison", head + "    return 1 if 0 < n < 9 else 0\n", /do not chain/],
    ["is with a value", head + "    return 1 if n is 3 else 0\n", /None only/],
    ["inheritance", "class P(Base):\n    x: int\n", /inherit/],
    ["method in a class", "class P:\n    x: int\n    def m(self) -> int:\n        return 1\n", /no methods/],
    ["type union", "def f(x: int | None) -> int:\n    return 1\n", /Option\[T\]/],
    ["format spec", head + '    print(f"{n:.2f}")\n    return 0\n', /format/],
    ["match as an expression", head + "    return 1 + match n:\n", /match is a statement/],
    ["tuple binding", head + "    a, b = 1, 2\n    return a\n", /one name per statement/],
  ];
  for (const [name, src, msg] of bad) {
    it(name, () => {
      const d = parseError(src);
      expect(d.code).toMatch(/^[PS]00\d$/);
      expect(d.message).toMatch(msg);
      expect(d.line).toBeGreaterThan(0);
    });
  }

  it("a method call on a value is a type error that says Canon has no methods", () => {
    const d = diags("def f(s: str) -> list[str]:\n    return s.split(\",\")\n");
    expect(d[0].code).toBe("T002");
    expect(d[0].message).toMatch(/no methods/);
  });

  it("a match nested in an expression cannot be printed as Canon-Py (S001), but is fine in braces", () => {
    const brace = "fn f(o: Option[Int]) -> Int {\n  return 1 + (match o {\n    Some(n) => n,\n    None => 0,\n  })\n}\n";
    expect(fmt(brace)).toBe(brace);
    expect(parseError(brace).code).toBe("S001");
  });
});

describe("Canon-Py: bindings", () => {
  it("infers mutability: an assigned name is a var, and only assignments mutate", () => {
    const src = "@effects(io)\ndef main() -> None:\n    n = 0\n    for x in [1, 2, 3]:\n        n += x\n    print(to_string(n))\n";
    expect(codes(src)).toEqual([]);
    expect(run(src)).toBe("6");
    expect(fmt(src)).toContain("var n = 0");
  });

  it("assigning to a parameter rebinds a local copy; the caller's value is unchanged", () => {
    const src = "def bump(xs: list[int]) -> int:\n    xs = append(xs, 4)\n    return len(xs)\n\n@effects(io)\ndef main() -> None:\n    xs = [1, 2]\n    print(f\"{bump(xs)} {len(xs)}\")\n";
    expect(codes(src)).toEqual([]);
    expect(run(src)).toBe("3 2");
  });

  it("names are block scoped, and T002 says how to fix it", () => {
    const d = diags("def f(c: bool) -> int:\n    if c:\n        y = 1\n    else:\n        y = 2\n    return y\n");
    expect(d[0].code).toBe("T002");
    expect(d[0].message).toMatch(/bind y before that block/);
  });

  it("a loop variable cannot be assigned (T006, in Canon-Py words)", () => {
    const d = diags("def f(xs: list[int]) -> int:\n    for x in xs:\n        x = 1\n    return 0\n");
    expect(d[0].code).toBe("T006");
    expect(d[0].message).toMatch(/loop variable/);
  });

  it("converting brace code renames a shadowing let and drops `let x = x`", () => {
    const brace = "fn f(s: String) -> String {\n  let s = trim(s)\n  let t = s\n  let t = t + \"!\"\n  return t\n}\n";
    expect(pyFmt(brace)).toBe('def f(s: str) -> str:\n    s_2 = trim(s)\n    t = s_2\n    t_2 = t + "!"\n    return t_2\n');
  });
});

describe("Canon-Py: names that are Python keywords", () => {
  it("statement keywords Canon lacks stay usable as names", () => {
    const src = "def settle(from: str, to: str) -> str:\n    with = from + to\n    return with\n";
    expect(pyFmt(src)).toBe(src);
    expect(codes(src)).toEqual([]);
    expect(parseError("def f() -> None:\n    from x import y\n").message).toMatch(/does not exist/);
    expect(parseError("from std import text\n").message).toMatch(/import std\.name/);
  });

  it("a Canon name that is a Python hard keyword is renamed name_ when converting", () => {
    const brace = "type Rule {\n  case: String,\n}\n\nfn pass(class: Rule) -> String {\n  let is = class.case\n  return is\n}\n";
    const out = pyFmt(brace);
    expect(out).toBe("class Rule:\n    case_: str\n\ndef pass_(class_: Rule) -> str:\n    is_ = class_.case_\n    return is_\n");
    expect(codes(out)).toEqual([]);
  });
});

describe("Canon-Py: diagnostics and patches", () => {
  it("E101's patch adds the decorator", () => {
    const src = 'def main() -> None:\n    print("hi")\n';
    const d = diags(src).find((x) => x.code === "E101")!;
    expect(d.message).toContain("def main uses effects it does not declare: io (via print)");
    const fixed = applyPatch(src, d.fix!.diff)!;
    expect(fixed).toBe('@effects(io)\ndef main() -> None:\n    print("hi")\n');
    expect(codes(fixed)).toEqual([]);
  });

  it("T004's patch adds the missing cases with holes, which then report H001", () => {
    const src = "type Op = A | B | C\n\ndef f(o: Op) -> int:\n    match o:\n        case A:\n            return 1\n";
    const d = diags(src).find((x) => x.code === "T004")!;
    const fixed = applyPatch(src, d.fix!.diff)!;
    expect(fixed).toContain("        case B:\n            return ...\n        case C:\n            return ...\n");
    expect(codes(fixed)).toEqual(["H001", "H001"]);
  });

  it("type errors show Canon-Py types; T009's patch applies", () => {
    const d = diags("def f(n: int) -> str:\n    return n\n")[0];
    expect(d.message).toBe("type mismatch in return value: expected str, found int");
    const src = "def f(n: int, x: float) -> float:\n    return x * n\n";
    const t = diags(src).find((x) => x.code === "T009")!;
    expect(codes(applyPatch(src, t.fix!.diff)!)).toEqual([]);
  });

  it("T011 for an effectful function where a pure Callable is expected", () => {
    const src = "def each(xs: list[str], f: Callable[[str], None]) -> None:\n    for x in xs:\n        f(x)\n\n@effects(io)\ndef main() -> None:\n    each([\"a\"], print)\n";
    const d = diags(src).find((x) => x.code === "T011")!;
    expect(d.message).toContain("Callable[[str], None]");
    expect(d.message).toContain("Callable[[str], None, io]");
  });

  it("indexing a list with a literal says lists are not indexed (T008)", () => {
    const d = diags("def f(xs: list[int]) -> int:\n    return xs[0]\n")[0];
    expect(d.code).toBe("T008");
    expect(d.message).toBe("list[int] has no slot [0]: only tuples are indexed; for a list use first, last, take or drop, or a for loop");
  });

  it("a test function is a test; its effects are a decorator", () => {
    const src = '@effects(fs)\ndef test_writes() -> None:\n    r = write_file("/dev/null", "x")\n    assert r == r\n\ndef test_math() -> None:\n    assert 2 * 3 == 6\n';
    expect(codes(src)).toEqual([]);
    const results = runTests(compileJs(src, "main.cn", py).js!, testHost(new MemoryHost()));
    expect(results.map((t) => [t.name, t.passed])).toEqual([["writes", true], ["math", true]]);
    expect(diags(src.replace("@effects(fs)\n", ""))[0].message).toContain("def test_writes");
  });

  it("C001 on a brace file in Canon-Py mode, and on a Canon-Py file in brace mode, says which surface it is", () => {
    expect(diags("fn f() -> Int {\n  return 1\n}\n")[0].message).toMatch(/brace syntax/);
    expect(check("def f() -> int:\n    return 1\n").diagnostics[0].message).toMatch(/--syntax py/);
  });
});

describe("Canon-Py: fuzzing", () => {
  // noise that never changes meaning: indentation width, blank lines, spaces inside brackets and
  // around commas, redundant parentheses around a returned value, single quotes, trailing commas
  function mulberry(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noisy(src: string, r: () => number): string {
    const width = [2, 3, 4, 8][Math.floor(r() * 4)];
    const lines = src.split("\n").map((l) => {
      const ind = l.length - l.trimStart().length;
      let body = l.trimStart();
      if (body.startsWith("#")) return l.replace(/^ */, " ".repeat((ind / 4) * width));
      if (r() < 0.3 && !body.includes("\"")) body = body.replace(/, /g, " , ");
      if (r() < 0.3) body = body.replace(/\(([^()"]*)\)/, "( $1 )");
      if (r() < 0.3 && /^return \w[\w.]*$/.test(body)) body = body.replace(/^return (.*)$/, "return ($1)");
      if (r() < 0.3 && !body.includes("'") && !body.includes("\\") && /"[^"\\{}]*"/.test(body) && !body.startsWith("f\"") && !/f"/.test(body)) {
        body = body.replace(/"([^"\\{}]*)"/, "'$1'");
      }
      if (r() < 0.2 && /\[[^\]]+\]$/.test(body) && !body.startsWith("def ") && !body.includes(": ")) body = body.replace(/\]$/, ",]");
      return " ".repeat((ind / 4) * width) + body;
    });
    const out: string[] = [];
    for (const l of lines) {
      out.push(l);
      if (r() < 0.15 && l.trim() !== "") out.push("");
    }
    return out.join("\n");
  }
  const dirs = ["tests/py/examples", "tests/py/run"].map((d) => join(__dirname, "..", d));
  const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".cn")).map((f) => join(d, f)));

  it("collapses 1,000 noisy variants of the corpus to their canonical text, idempotently", () => {
    let n = 0;
    const r = mulberry(2026);
    while (n < 1000) {
      for (const f of files) {
        const canonical = readSource(readFileSync(f, "utf8"));
        const v = noisy(canonical, r);
        let got: string;
        try {
          got = pyFmt(v);
        } catch (e) {
          throw new Error(`${f}: variant failed to parse: ${(e as CanonError).diag?.message}\n${v}`);
        }
        expect(got, `${f}\n--- variant ---\n${v}`).toBe(canonical);
        expect(pyFmt(got)).toBe(got);
        n++;
      }
    }
  });
});
