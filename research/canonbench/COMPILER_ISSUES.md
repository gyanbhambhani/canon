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
