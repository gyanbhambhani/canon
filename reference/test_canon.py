"""Canon v0 test suite. Run: python test_canon.py

Property under test: for every program P,
  1. fmt is idempotent:            fmt(fmt(P)) == fmt(P)
  2. every equivalent surface form S of P (other whitespace, extra parens,
     pipelines vs nested calls, optional commas, else { if } vs else if)
     formats to the same text:     fmt(S) == fmt(P)
  3. check accepts exactly one:    check(S).canonical  <=>  S == fmt(P)
"""
import json
import random
import subprocess
import sys
from pathlib import Path

import canon

HERE = Path(__file__).parent
EXAMPLES = sorted((HERE / "examples").glob("*.cn"))
CANONICAL_EXAMPLES = [p for p in EXAMPLES if "messy" not in p.name]

results = []


def case(name):
    def wrap(fn):
        try:
            detail = fn()
            results.append((name, True, detail or ""))
        except Exception as e:
            results.append((name, False, f"{type(e).__name__}: {e}"))
        return fn
    return wrap


def apply_patch(src, diff):
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        Path(d, "main.cn").write_text(src)
        Path(d, "fix.diff").write_text(diff)
        p = subprocess.run(["patch", "-p1", "-i", "fix.diff"], cwd=d, capture_output=True,
                           text=True)
        assert p.returncode == 0, p.stdout + p.stderr
        return Path(d, "main.cn").read_text()


def codes(src):
    return [d["code"] for d in canon.check(src)["diagnostics"]]


# ---------------------------------------------------------------- round trips

@case("canonical examples are fixed points of fmt")
def _():
    for p in CANONICAL_EXAMPLES:
        src = p.read_text()
        assert canon.fmt(src) == src, f"{p.name} changed under fmt"
        r = canon.check(src)
        assert r["ok"] and r["canonical"], f"{p.name}: {r['diagnostics']}"
    return f"{len(CANONICAL_EXAMPLES)} files"


@case("hand-written messy file formats to the canonical file")
def _():
    messy = (HERE / "examples" / "orders_messy.cn").read_text()
    clean = (HERE / "examples" / "orders.cn").read_text()
    assert canon.fmt(messy) == clean
    assert codes(messy) == ["C001"]


# ---------------------------------------------------------------- fuzzing

def whitespace_fuzz(src, rng):
    """Re-join the token stream with random whitespace (comments keep their line)."""
    toks = canon.lex(src)
    out = []
    for t, nxt in zip(toks[:-1], toks[1:]):
        out.append(t.text)
        if t.kind == "comment":
            out.append("\n" * rng.randint(1, 3))
        elif nxt.kind == "op" and nxt.text == "(":
            # the one line-sensitive rule: keep a '(' on, or off, its previous line
            if nxt.line == t.line:
                out.append(rng.choice(["", " ", "  ", "\t"]))
            else:
                out.append(rng.choice(["\n", "\n\n", " \n    "]))
        else:
            out.append(rng.choice([" ", "  ", "\n", "\t", " \n    ", "\n\n"]))
    return "".join(out)


def ast_noise(src, rng):
    """Print the same tree with random extra parens, pipeline/call choice, commas."""
    prog = canon.normalize(canon.parse(src))
    return canon.Printer(noise=rng).program(prog)


N_FUZZ = 400


@case(f"structural fuzz: {N_FUZZ} variants per example collapse to one text")
def _():
    rng = random.Random(7)
    total = distinct = 0
    for p in CANONICAL_EXAMPLES:
        src = p.read_text()
        seen = set()
        for _ in range(N_FUZZ):
            variant = whitespace_fuzz(ast_noise(src, rng), rng)
            seen.add(variant)
            out = canon.fmt(variant)
            assert out == src, f"{p.name}: variant did not collapse\n---\n{variant}\n---\n{out}"
            r = canon.check(variant)
            if variant != src:
                assert not r["canonical"] and r["diagnostics"][0]["code"] == "C001"
            total += 1
        distinct += len(seen)
    return f"{total} variants ({distinct} distinct texts) -> {len(CANONICAL_EXAMPLES)} canonical texts"


@case("fmt is idempotent on every fuzzed variant")
def _():
    rng = random.Random(11)
    for p in CANONICAL_EXAMPLES:
        src = p.read_text()
        for _ in range(100):
            once = canon.fmt(whitespace_fuzz(ast_noise(src, rng), rng))
            assert canon.fmt(once) == once


# ---------------------------------------------------------------- one-way rules

@case("pipeline rule: 3+ chained stages print as a pipeline, fewer as calls")
def _():
    assert canon.fmt("fn f(x: Int) -> Int {\n  return x |> a() |> b()\n}\n") == \
        "fn f(x: Int) -> Int {\n  return b(a(x))\n}\n"
    assert canon.fmt("fn f(x: Int) -> Int {\n  return c(b(a(x)))\n}\n") == \
        "fn f(x: Int) -> Int {\n  return x\n    |> a()\n    |> b()\n    |> c()\n}\n"
    # a literal first argument never flows down a pipe
    assert canon.fmt("fn f(n: Int) -> Int {\n  return 0 |> range(n) |> a() |> b() |> c()\n}\n") == \
        "fn f(n: Int) -> Int {\n  return range(0, n)\n    |> a()\n    |> b()\n    |> c()\n}\n"
    assert canon.fmt("fn f(n: Int) -> Int {\n  return 0 |> range(n) |> a() |> b()\n}\n") == \
        "fn f(n: Int) -> Int {\n  return b(a(range(0, n)))\n}\n"


@case("boolean comparisons collapse: x == true -> x, x == false -> not x")
def _():
    src = "fn f(x: Bool) -> Bool {\n  return x == false\n}\n"
    assert canon.fmt(src) == "fn f(x: Bool) -> Bool {\n  return not x\n}\n"


@case("literal forms collapse: 007 -> 7, 1.50 -> 1.5, 1e3 -> 1000.0")
def _():
    src = "fn f() -> Float {\n  return 007 + 1.50 + 1e3\n}\n"
    assert canon.fmt(src) == "fn f() -> Float {\n  return 7 + 1.5 + 1000.0\n}\n"


@case("precedence-required parens survive, redundant ones vanish")
def _():
    src = "fn f(a: Int, b: Int, c: Int) -> Int {\n  return ((a - (b - c))) * (a + b)\n}\n"
    assert canon.fmt(src) == "fn f(a: Int, b: Int, c: Int) -> Int {\n  return (a - (b - c)) * (a + b)\n}\n"


@case("rejected constructs give a pointed message")
def _():
    bad = {
        "fn f() -> Int {\n  let x: Int = 1\n  return x\n}\n": "P003",
        "fn f() -> Int {\n  let s = 'hi'\n  return 1\n}\n": "P001",
        "fn f(a: Int) -> Bool {\n  return 1 < a < 3\n}\n": "P001",
        "fn f(a: Int) -> Int {\n  a + 1\n  return a\n}\n": "P004",
        "fn f() {\n  return 1\n}\n": "P001",
        "fn f(a: Int) -> Int {\n  return g(match a { _ => 1 })\n}\n": "S001",
    }
    for src, code in bad.items():
        got = codes(src)
        assert got == [code], f"expected {code}, got {got} for:\n{src}"
    return f"{len(bad)} cases"


# ---------------------------------------------------------------- semantic checks

@case("effects: a missing effect is an error whose patch fixes it")
def _():
    src = "fn greet(name: String) -> Unit {\n  print(name)\n}\n"
    r = canon.check(src)
    d = r["diagnostics"][0]
    assert d["code"] == "E101" and d["data"]["missing"] == ["io"], d
    fixed = apply_patch(src, d["fix"]["diff"])
    assert canon.check(fixed)["ok"], canon.check(fixed)
    return "patch applied cleanly; fixed file passes"


@case("effects propagate through user functions")
def _():
    src = ("fn log(m: String) -> Unit\n  effects: io\n{\n  print(m)\n}\n\n"
           "fn run() -> Unit {\n  log(\"hi\")\n}\n")
    assert codes(src) == ["E101"]


@case("effects: an unused declared effect is an error (lists are exact)")
def _():
    src = "fn add(a: Int, b: Int) -> Int\n  effects: net\n{\n  return a + b\n}\n"
    assert codes(src) == ["E102"]


@case("holes report the expected type and fitting functions")
def _():
    src = ("fn total(xs: List[Int]) -> Int {\n  return sum(xs)\n}\n\n"
           "fn biggest(xs: List[Int]) -> Int {\n  return max(xs)\n}\n\n"
           "fn score(xs: List[Int]) -> Int {\n  return ?best\n}\n")
    d = canon.check(src)["diagnostics"][0]
    assert d["code"] == "H001" and d["data"]["expected"] == "Int", d
    assert len(d["data"]["candidates"]) == 2, d
    return d["message"]


@case("naming: snake_case values, PascalCase types")
def _():
    src = "fn getUser(id: Int) -> Int {\n  return id\n}\n"
    assert codes(src) == ["N001"]


@case("parse errors carry line and column")
def _():
    d = canon.check("fn f() -> Int {\n  return (1 +\n}\n")["diagnostics"][0]
    assert d["code"] == "P001" and d["line"] == 3 and d["col"] == 1, d


@case("CLI: check prints JSON and exits 1 on a non-canonical file")
def _():
    p = subprocess.run([sys.executable, str(HERE / "canon.py"), "check",
                        str(HERE / "examples" / "orders_messy.cn")],
                       capture_output=True, text=True)
    assert p.returncode == 1 and json.loads(p.stdout)["diagnostics"][0]["code"] == "C001"


if __name__ == "__main__":
    width = max(len(n) for n, _, _ in results)
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)
