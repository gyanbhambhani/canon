# FS-1 tasks, batch A (catalog): notes

Judgment calls, dropped tasks and the harness and compiler issues found while writing batch A.
Each entry: date, decision, reason.

## Result

All 18 tasks verify (PASS in direct, openapi and canon); none dropped.

| Task | Kind | Validation agreement (direct / openapi / canon) |
| --- | --- | --- |
| search-products | feature | 0.56 / 0.56 / 1 |
| products-in-price-range | feature | 0.273 / 0.273 / 1 |
| low-stock-report | feature | 0.744 / 0.744 / 1 |
| list-tags | feature | no rule |
| product-count-by-tag | feature | no rule |
| related-products | feature | no rule |
| product-reviews | feature | addReview 0.167 / 0.167 / 1 |
| average-rating | feature | rateProduct 0.252 / 0.252 / 1 |
| top-rated-products | feature | rateProduct 0.252 / 0.252 / 1; topRatedProducts 0.098 / 0.098 / 1 |
| product-price-label | feature | no rule |
| bulk-restock | feature | no spec possible (H1) |
| discontinue-product | feature | no rule |
| rename-product-name-to-title | change | no rule |
| add-required-category | change | no spec possible (H1) |
| stock-optional | change | no spec possible (H1) |
| split-list-products | change | listProducts 0.186 / 0.186 / 1; listTaggedProducts 0.179 / 0.179 / 1 |
| tags-to-string | change | no rule |
| min-price-validation | change | no spec possible (H1) |

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

### C2. A portable `requires` cannot constrain an Option's value, or a list's items (language gap)

The portable subset (A003) has no `unwrap_or`, `match` or lambda, so "stock, when present, is not
negative" and "every item's amount is positive" cannot be request validation in Canon:

```
type Thing {
  sku: String,
  stock: Option[Int],
}

api fn add_thing(t: Thing) -> Thing
  route: POST "/things"
  requires: str_len(t.sku) >= 3 && unwrap_or(t.stock, 0) >= 0
{
  return t
}
```

gives `A003: ... cannot use a call to unwrap_or`. stock-optional and bulk-restock therefore make
those two rules 400 `Invalid` domain errors in every arm (see the judgment calls). Suggested
addition to the portable subset: `unwrap_or` (it is the same in Python and TypeScript), and perhaps
an `all(xs, |x| ...)` restricted to a field comparison.

### C3. COMPILER_ISSUES #1 again: a long `requires` has no fix (L001)

add-required-category wanted `category` to be one of "food", "drink", "tool":
`requires: str_len(p.sku) >= 3 && p.cents >= 0 && p.stock >= 0 && contains(["food", "drink", "tool"], p.category)`
is 114 characters with the parameter already shortened to `p`, and a second `requires:` clause is
joined into the same line. The task uses a rule that fits instead (see below).

### H1. Validation specs cannot generate objects or lists (harness)

`ValidationSpec.args` draws one primitive per feature argument (`email`, `name`, `string`, `int`,
...). A feature that takes a record or a list, like `addProduct(baseUrl, product)` or
`bulkRestock(baseUrl, items)`, cannot be sampled, so the tasks that add a rule to `POST /products`
(add-required-category, min-price-validation, stock-optional) and bulk-restock have no validation
spec. Those are exactly the change tasks where agreement is most interesting. Suggested fix: let an
argument be a template whose leaves are generators, for example
`{ "name": "product", "gen": { "sku": "sku", "name": "name", "cents": "int", "stock": "int", "tags": [] } }`.

### Notes (not bugs)
- `canon fmt` has no `--check`; batch A checked canonical form by running `canon check --fix --write`
  on a copy and comparing (every batch-A Canon reference is byte-identical after it).
- Canon has no list concatenation (`+` joins Strings only), so flattening every product's tags
  (list-tags, product-count-by-tag) takes a nested `for` loop with `append`.

## Judgment calls

### 2026-11-23 — Who wrote what
Decision: search-products was written first as the pattern; the other 17 were written by four
parallel helpers from one shared brief (designs below), each told the pitfalls above, then all 18
were verified together in one `verify` run (54 PASS).
Reason: time; the shared brief keeps the conventions identical.

### 2026-11-23 — Client tests on the shared live server
Decision: global endpoints (`/tags`, `/tags/counts`, `/low-stock`, `/price-range`, `/top-rated`,
`/search`) are checked in client tests by comparing the feature's value with `t.http` ground truth,
checking order over the whole list, and asserting exact rows only for the test's own `t.unique`
SKUs and tags. products-in-price-range uses prices near 7,000,000 plus a per-process offset so only
its own products fall in the range. Only top-rated-products' client tests create ratings.
Reason: every client test of a run shares one server and database.

### 2026-11-23 — Tasks are independent, so rating tasks repeat the ratings endpoint
Decision: average-rating and top-rated-products each add `POST /products/{sku}/ratings`
(`{"stars": 1..5}` → `{"sku", "count", "average"}`), described in full in each task.md;
product-reviews is a separate model (rating plus text, `/products/{sku}/reviews`).
Reason: every task applies to the bare starter; neither can assume another task's tables.

### 2026-11-23 — Averages are exact means
Decision: `average` is the exact mean as a JSON number (null for no ratings in average-rating).
pytest compares 13/3 with `pytest.approx`; client tests use exact values (4.5, 3.5, 5).
Reason: rounding rules differ (Python rounds half to even); an exact mean is the same in every
runtime.

### 2026-11-23 — Validation before lookup
Decision: tests never combine an invalid body with an unknown SKU.
Reason: Canon's `requires` and Pydantic run before the handler, a hand-written check may not; the
order is not stated, so it is not tested (it only moves the agreement metric).

### 2026-11-23 — bulk-restock: a bad amount is 400 `Invalid`, not 422
Decision: `items` having 1 to 20 entries is the validation rule (422); an amount of 0 or less is
400 `{"kind": "Invalid", "reason": "amount for <sku> is not positive"}`, checked in item order after
the SKU, all or nothing.
Reason: C2: Canon's request validation cannot look inside list items. Stating it as a domain error
keeps one contract for all arms.

### 2026-11-23 — stock-optional: a known negative stock is 400 `Invalid`
Decision: `stock` is an integer or null, the key always present (Canon's Option fields are required
keys; omission is not tested). A negative known stock is 400
`{"kind": "Invalid", "reason": "stock is negative"}`; sku and cents stay 422. Restocking unknown
stock sets it to the amount. `test_product_validation` is superseded and its sku and cents checks
re-tested.
Reason: C2. The alternative (keeping 422) has no Canon reference, so the task could not be used.
This does ask the hand-written arms to move one check from 422 to 400; the task says so plainly.

### 2026-11-23 — add-required-category: "not blank" instead of an enum
Decision: `category` is a required string with at least one non-whitespace character (422
otherwise, or when missing), stored as sent. The 12 regression tests that post category-less
products are superseded (the same list as rename-product-cents).
Reason: C3; the enum rule does not fit a Canon `requires` line.

### 2026-11-23 — Change tasks re-test `test_product_validation` in the new shape
Decision: rename-product-name-to-title, add-required-category and tags-to-string supersede it (as
rename-product-cents does) and re-check sku, cents and stock in the new shape.
Reason: the original still passes, but only because the old-shape body is rejected for its shape.

### 2026-11-23 — min-price-validation supersedes nothing
Decision: `supersedes: []`.
Reason: no regression test uses a price of 0, so all of them still hold.

### 2026-11-23 — discontinue-product keeps the Product shape
Decision: the flag is stored apart from the product's JSON (a column or a table); discontinued
products leave `GET /products` (with or without a tag, and pages count only listed products) but
`GET /products/{sku}` still returns them. What deleting does to the flag is unspecified and untested.
Reason: a new field on Product would break every regression test that compares whole products.

### 2026-11-23 — split-list-products and tags-to-string leave edge inputs unspecified
Decision: a `tag` still sent to `GET /products` (split-list-products) and an empty `?tag=`
(tags-to-string) are not specified and not tested.
Reason: FastAPI ignores unknown query parameters, and an empty tag item has no obvious meaning.

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
