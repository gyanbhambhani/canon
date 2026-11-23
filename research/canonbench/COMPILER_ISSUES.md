# Compiler issues found by CanonBench

## CB-1: generated Python hoists `unwrap_or` temporaries out of lambdas and loop conditions

Found 2026-11-23 while verifying that every Canon reference passes its hidden tests after
`generateFastapi` (THINK's Canon -> Python path). Compiler at main 7642040.

`unwrap_or(<option expression>, default)` is lowered to a temporary (`found = ...`) followed by
`found if found is not None else default`. The temporary is emitted as a statement *before the
enclosing statement*, which is wrong when the expression sits inside a lambda (it refers to the
lambda's parameter, giving a NameError) or inside a `while` condition (it is evaluated once,
not on every iteration, giving wrong results or infinite loops).

Minimal reproduction (`canon check` reports no diagnostics; the JavaScript target is correct):

```canon
fn to_ints(xs: List[String]) -> List[Int] {
  return map(xs, |p| unwrap_or(parse_int(p), 0))
}

fn drop_trailing_x(cs: List[String]) -> List[String] {
  var out = cs
  while len(out) > 0 && unwrap_or(last(out), "") == "x" {
    out = take(out, len(out) - 1)
  }
  return out
}
```

Generated `logic.py`:

```python
def to_ints(xs: list[str]) -> list[int]:
    found = parse_int(p)                      # NameError: p is not defined
    return [found if found is not None else 0 for p in xs]


def drop_trailing_x(cs: list[str]) -> list[str]:
    out = cs
    found = out[-1] if out else None          # evaluated once, before the loop
    while len(out) > 0 and (found if found is not None else "") == "x":
        out = out[: max(len(out) - 1, 0)]
    return out
```

Impact on CanonBench: 4 of the 60 Experiment 1 Canon references fail their hidden tests after
compiling to Python (align_columns, compare_versions, next_permutation, poker_hand), all through
this bug. Those references pass every test on the JavaScript runtime.

How CanonBench handles it: the compiler is not patched (packages/ is out of scope). The THINK
family uses the compiler as shipped, so model programs that hit this bug fail in the THINK
"through Canon" arm; that is a real cost of the toolchain today and is reported as such. The
report also gives THINK's result with these failures attributed (how many Canon-arm programs pass
on the JavaScript runtime but fail after compiling to Python).

Suggested fix: when the lowered expression is inside a lambda body or a loop condition, use an
inline form (for example a walrus `(found := parse_int(p)) if ... ` or a runtime helper
`unwrap_or(x, d)`), or hoist into a local helper function.

**Status: fixed on main in 0a38eba** (an `unwrap_or` whose arguments aren't plain names, literals
or fields now compiles to a runtime helper call; a match or try inside a lambda, comprehension or
while condition is G002). CanonBench pinned c2cb47e, which includes the fix.

## CB-2: generated Python breaks a comprehension's tuple target across lines (SyntaxError)

Found 2026-11-23 in the THINK family (GPT-6.2 Sol's Canon programs compiled to Python). Present
on the pinned compiler (c2cb47e) and on main's built compiler when checked. Not fixed.

When a comprehension produced from `filter` / `map` over pairs is wrapped, the printer splits the
tuple target of `for key, members in ...` over several lines. Python does not allow that, so the
module fails to import. `canon check` is clean and the JavaScript is correct.

Minimal reproduction:

```canon
fn groups(words: List[String]) -> List[List[String]] {
  return words
    |> group_by(|w| str_len(w))
    |> filter(|key, members| len(members) >= 2)
    |> map(|key, members| members)
}
```

Generated `logic.py`:

```python
def groups(words: list[str]) -> list[list[str]]:
    return [
        members
        for key,
        members
        in [
            (key, members)
            for key, members in group_by(words, lambda w: len(w))
            if len(members) >= 2
        ],
    ]
```

Impact: 2 of GPT-6.2 Sol's 180 Canon WRITE programs (anagram_groups run 1,
top_product_per_region run 1) pass every hidden test on the JavaScript runtime and fail to import
after compiling to Python. Suggested fix: keep `for a, b in` on one line, or parenthesize the
target (`for (key, members) in`), when the printer wraps a comprehension.

## Limitation seen in THINK (not a bug): G002 for an Option of an Option

The Python target refuses `Option[Option[T]]` (G002: Python writes Option[T] as `T | None`, which
cannot nest). GPT-6.2 Sol's parking_fees programs wrote `unwrap_or(map_get(parked, plate), None)`
on a map of optional values in 3 of 3 runs; each checks clean and passes on the JavaScript
runtime, and the Python generator refuses it. In THINK these count as failures. The core agent
reference does not warn that this shape cannot be compiled to Python.
