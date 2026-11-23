# FS-1 tasks, batch A (catalog): notes

Judgment calls, dropped tasks and the harness and compiler issues found while writing batch A.
Each entry: date, decision, reason.

## Issues found

### C1. `unwrap_or` inside a lambda generates Python that reads an unbound name (compiler)

When the first argument of `unwrap_or` is not a plain name (for example `map_get(m, x)`), the
Python generator binds it to a temporary *before* the statement. Inside a lambda that temporary
refers to the lambda's parameter, which does not exist outside the comprehension. `canon check`
and `canon test` pass (the TypeScript and interpreter paths are right); the generated Python raises
`NameError` at run time, so the endpoint answers 500.

Minimal reproduction (`canon check` and `canon test` pass, then `canon build`):

```
fn rename_all(names: Map[String, String], xs: List[String]) -> List[String] {
  return map(xs, |x| unwrap_or(map_get(names, x), x))
}
```

generates

```python
def rename_all(names: dict[str, str], xs: list[str]) -> list[str]:
    found = names.get(x)
    return [found if found is not None else x for x in xs]
```

Workaround (search-products): move the `unwrap_or` into a named helper function and call it from
the lambda. Suggested fix: in `pygen.ts` (the `unwrap_or` case), never hoist a temporary out of a
lambda body; inside a lambda use a walrus (`(t := names.get(x)) if ... `) or a conditional on a
repeated pure call.

## Judgment calls

### 2026-11-23 — New routes avoid `/products/<word>`
Decision: new collection-level GET routes live outside `/products/...` (`/search`, `/price-range`,
`/low-stock`, `/tags`, ...), while per-product routes are `/products/{sku}/<word>`.
Reason: the starters already route `GET /products/{sku}`; a FastAPI route `GET /products/search`
added after it is shadowed (it answers `Missing`). That trap is real, but it would test route
ordering in the hand-written arms rather than the feature, and it is not what these tasks measure.

### 2026-11-23 — search-products matches ASCII case only
Decision: "ignores the case of the letters A to Z"; other characters match exactly.
Reason: Canon has no lowercase built-in, and Python's `str.lower` and JavaScript's `toLowerCase`
differ outside ASCII. Stating ASCII makes the task the same in every arm; the hidden tests use ASCII
names. The Canon reference writes `ascii_lower` with `split(s, "")` and a map.
