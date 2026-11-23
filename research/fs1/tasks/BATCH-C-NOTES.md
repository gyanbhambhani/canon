# FS-1 task batch C (orders and payments): notes

Batch C: 18 tasks, 12 features and 6 changes. All 18 verify: `harness/verify.ts` prints PASS for
direct, openapi and canon. None were dropped.

Each task was also run against the bare starters. Every task test fails there, except two
deliberate guards that check behavior which must not change:
- order-detail: `test_open_and_first_still_work`;
- total-to-money: `test_summaries_keep_integer_cents`.

The references pass ruff, ruff format, `canon check` and eslint without auto-fixes.

| Task | Kind | Tests per arm | Validation agreement (direct / openapi / canon) |
| --- | --- | --- | --- |
| order-detail | feature | 23 | none (no rule) |
| add-line-to-order | feature | 24 | 0.698 / 0.698 / 1 |
| remove-line-from-order | feature | 23 | none |
| refund-order | feature | 23 | none |
| ship-order | feature | 23 | 0.719 / 0.719 / 1 |
| orders-by-status | feature | 23 | 0 / 0 / 1 |
| revenue-report | feature | 21 | none |
| order-notes | feature | 24 | 0.601 / 0.601 / 1 |
| discount-codes | feature | 24 | 0.197 / 0.197 / 1 |
| reorder | feature | 22 | none |
| stock-on-pay | feature | 24 | none |
| order-count-badge | feature | 22 | none |
| rename-quantity-to-qty | change | 18 | none (no generator for lists) |
| add-required-shipping-address | change | 19 | none (no generator for lists) |
| total-to-money | change | 18 | none |
| split-pay | change | 22 | none |
| max-quantity-validation | change | 23 | none (a 400 rule, not 422) |
| status-to-string | change | 20 | 0 / 1 / 1 |

## Judgment calls

Each entry: date, decision, reason.

### 2026-11-23: Every unknown order is `Missing` with `sku: "order <id>"`
Decision: every new order endpoint answers an unknown order the way `POST /orders/{id}/pay` does.
A non-open order is `Invalid` with a reason that task.md states exactly, such as `order <id> is not
open`, `is not paid` or `is not authorized`.
Reason: the starter already uses this convention, and cancel-order follows it. When a test checks
reason text, it is text that task.md gives word for word.

### 2026-11-23: Checks run in a stated order
Decision: when one request breaks several rules, task.md says which check comes first. The order
is: the 422 rule, then the unknown order, then the status, then the unknown product or code. The
tests rely on this order.
Reason: every arm must give the same answer to the same request. Putting validation first also
keeps validation agreement well defined.

### 2026-11-23: The payments fake is extended only the way the starters allow
Decision: refund-order and split-pay call new provider endpoints: `/refund`, `/authorize` and
`/capture` on payments.example.com. The body is the total in cents, as for a charge.
- direct and openapi: the references add methods to `PaymentClient` and override them in
  `FakePayments`.
- canon: the reference calls `http_post` under `net(payments.example.com)`, and `main.py` is not
  edited. Its `FakePayments` already answers every POST with `test-receipt-<body>`.

task.md states this behavior of the fake.
Reason: the starters' fake switch is the only mock that every arm has.

### 2026-11-23: split-pay removes the old endpoint and `charge`
Decision: after the change, `POST /orders/{id}/pay` is 404 or 405, and the test accepts either.
`payOrder.ts` is deleted through DELETE lists. Provider failures are now `PaymentFailed`; the old
pay endpoint reported them as `Missing`. The fake never fails, so this is stated but not tested.
Reason: "one endpoint becomes two." FastAPI answers 405 or 404 depending on which other routes
share the path, and Canon generates FastAPI routes.

### 2026-11-23: max-quantity-validation is a typed 400 error, not a 422
Decision: the first line whose quantity is outside 1..99 gets 400
`{"kind": "BadQuantity", "sku": ..., "quantity": ...}`. It is checked before any product lookup,
and no order is created. The task has no validation spec.
Reason: Canon's `requires` cannot check each element of a list (see "Language and compiler
issues" below). A 422 rule would be impossible to write in the Canon arm. A typed domain error can
be written in all three arms and still changes both sides.

### 2026-11-23: add-required-shipping-address checks only a minimum length
Decision: the rule is "after trimming, at least 5 characters". The planned rule was 5 to 50.
Reason: in Canon, the 5-to-50 rule on a field called `shipping_address` is a requires line of 113
characters, even with a one-letter parameter. That line is L001 with no fix (COMPILER_ISSUES.md
#1, reproduced below), and writing two `requires:` clauses gives C001, whose patch joins them back
into one line. The Canon arm could not express the planned rule canonically, so the task would not
be fair to it.

### 2026-11-23: No validation spec where the feature takes a `Line[]`
Decision: add-required-shipping-address and rename-quantity-to-qty have no `validation` spec.
Reason: `placeOrder` takes `lines: Line[]`, and the generators in `harness/client-runner.ts`
produce only scalars. Their rules are covered by HTTP and client tests instead.

### 2026-11-23: Some validation specs score 0 for arms that do not validate on the client
Decision: in orders-by-status and status-to-string, the `string` generator never produces a valid
status value. The server therefore answers 422 to every sample, and an arm without a client-side
check agrees on none of them. The specs were kept.
- status-to-string: the openapi reference narrows the string to the generated literal-union type
  and rejects other values on the client, so it scores 1. That is ordinary for that arm.
- Other hand-written references: they do not validate on the client, as in the signup-age and
  paginate-orders references.

Reason: the spec still separates clients that validate from clients that do not. The harness has
no generator for enumerated values.

### 2026-11-23: Smaller specification choices
- order-notes stores notes in their own table, so the Order JSON is unchanged and no regression
  test is superseded. `GET` returns `note: ""` when no note is set. The note must not be blank
  after trimming, and is at most 50 characters as given.
- remove-line-from-order: the total drops by the product's current price times the line's
  quantity. A line whose product was deleted is `Missing`; task.md states this, but it is not
  tested. Removing the only line is `Invalid "order <id> would be empty"`.
- add-line-to-order: adding a sku that is already in the order grows that line's quantity and
  keeps its position. Otherwise the line is appended.
- reorder: totals use current prices. The probe deletes a product and re-adds it at a new price.
- order-count-badge: the endpoint is `GET /users/{email}/badge`. It returns `NoUser` for an email
  that never signed up, and its label caps at "9+ open orders". This keeps it apart from the
  starter's `GET /orders/open`.
- discount-codes: the discounted total is `total - floor(total * percent / 100)`, and further codes
  compound. Tests use only non-negative totals. Python's `//` floors and Canon's `/` truncates, and
  the two differ only below zero.
- stock-on-pay: paying a paid order again is now `Invalid "order <id> is paid"`. Without that, a
  second pay would take the stock twice. Two lines with the same sku are not specified or tested.
- status-to-string: the status strings are lowercase (`open`, `paid`, `cancelled`), and `receipt`
  is a string or null. The new `GET /orders/count?email=&status=` carries the validated status.
  `GET /orders/open` is kept.
- total-to-money: `Money` is `{cents, currency}`, and currency is always "USD". `/summaries` keeps
  `spent` as an integer.
- Canon references put new error variants on the existing sum types (`CatalogError`, `UserError`)
  and new statuses on `Status`. Variant names must be unique across a project: a second `Missing`
  is T001.

## Language and compiler issues

### 1. `requires` cannot check each element of a list (A003)
An api fn's `requires` may call only `str_len`, `trim`, `contains`, `len`, `is_email` and
`is_some`, with no lambdas. So "every line has a quantity between 1 and 99" cannot be written:

```
type Line {
  sku: String,
  quantity: Int,
}

type NewOrder {
  lines: List[Line],
}

api fn place(input: NewOrder) -> Int
  route: POST "/orders"
  requires: all(input.lines, |l| l.quantity >= 1 && l.quantity <= 99)
{
  return 1
}
```

This is A003, once for the call and once for the lambda (and `all` is not a built-in). A Canon
program must fall back on a 400 domain error in the body. As a result, it gets neither a 422 nor
client-side validation for per-element rules. This is a language limit, not a bug, and it affects
FS-1's claim that Canon "writes validation once".

Suggested fix: a portable `all(xs, |x| ...)` (and `any`) in requires, with a one-expression
lambda limited to the same portable subset.

### 2. A long `requires` still has no fix (COMPILER_ISSUES.md #1)
This was confirmed again. In a project, `canon check --json` reports
`L001: line is 113 characters (limit 100)` for:

```
type NewOrder {
  email: String,
  lines: List[String],
  shipping_address: String,
}

api fn place_order(n: NewOrder) -> Int
  route: POST "/orders"
  requires: len(n.lines) > 0 && str_len(trim(n.shipping_address)) >= 5 && str_len(trim(n.shipping_address)) <= 50
{
  return 1
}
```

Splitting the rule into two `requires:` lines gives C001, and its patch joins them back into the
113-character line. It shaped add-required-shipping-address (see above).

### 3. Minor: no comment inside a record type
A `#` comment between the fields of a `type` is P002. A comment goes above the type instead.

### Harness
No bugs found. Its limits, worked around above:
- There are no list, record or enumerated-value generators for validation specs.
- Validation agreement is reported but does not affect PASS, which is by design.
