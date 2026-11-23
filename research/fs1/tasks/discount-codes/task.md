# Add discount codes

The shop wants discount codes: a code takes a percentage off an open order.

**Backend:** store discount codes (a new table), and add two endpoints.
- `POST /discounts` with the body `{"code": "<code>", "percent": <int>}` creates a code and returns it, `{"code": ..., "percent": ...}`.
  - Validation: `code` has at least 3 characters, and `percent` is between 1 and 100 (both included). Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.
  - A code that already exists is 400 with `{"error": {"kind": "Invalid", "reason": "duplicate code <code>"}}`.
- `POST /orders/{id}/discount` with the body `{"code": "<code>"}` applies a code to an order and returns the updated order. Its checks, in this order:
  - an unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying;
  - an order whose status is not `Open` is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not open"}}`;
  - an unknown code is 400 with `{"error": {"kind": "UnknownCode", "code": "<code>"}}`.

  The order's `total` becomes `total - (total × percent ÷ 100, rounded down)`: 2209 at 10% becomes 2209 − 220 = 1989. Every other field is unchanged. Applying another code takes its percentage off the new total. Paying the order afterwards charges the new total.

**Frontend:** add two feature modules:
- `frontend/src/features/addDiscount.ts`, exporting

  ```ts
  addDiscount(baseUrl: string, code: string, percent: number): Promise<Outcome<Discount>>
  ```
- `frontend/src/features/applyDiscount.ts`, exporting

  ```ts
  applyDiscount(baseUrl: string, orderId: number, code: string): Promise<Outcome<Order>>
  ```

`Discount` is a new type, `{code, percent}`. Each returns the value, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
