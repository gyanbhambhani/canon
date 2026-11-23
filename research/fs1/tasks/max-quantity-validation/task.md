# Limit an order line's quantity to 1..99

Today an order line may ask for zero, a negative number, or any number of a product. From now on every line's `quantity` must be between 1 and 99 (both included).

- `POST /orders` checks every line before it looks up any product. The first line, in order, whose `quantity` is below 1 or above 99 is rejected with 400 and `{"error": {"kind": "BadQuantity", "sku": "<that line's sku>", "quantity": <its quantity>}}`. No order is created.
- The existing rules still apply: an order with no lines is 422 `ValidationError`, and an unknown product (on an order whose quantities are all valid) is 400 `Missing`.
- Valid orders behave exactly as before: totals, paying, `/summaries`, `/customers`, `/orders/open` and `/orders/first`.

**Frontend:** `frontend/src/features/placeOrder.ts` keeps its signature; its errors now include `BadQuantity` (with `sku` and `quantity`):

```ts
placeOrder(baseUrl: string, email: string, lines: Line[]): Promise<Outcome<Order>>
```
