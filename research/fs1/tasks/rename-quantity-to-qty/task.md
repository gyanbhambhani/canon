# Rename an order line's `quantity` field to `qty`

The order line field `quantity` is renamed `qty` everywhere: in the body of `POST /orders` (`{"email": ..., "lines": [{"sku": ..., "qty": ...}]}`), in every order the API returns (`POST /orders`, `POST /orders/{id}/pay`), in the frontend's `Line` type and in every feature module that sends or reads a line. The behavior does not change: totals, paying, `/summaries`, `/customers`, `/orders/open` and `/orders/first` work as before.

After the change, no request or response uses the name `quantity`. A line sent with `quantity` instead of `qty` is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** `frontend/src/features/placeOrder.ts` keeps its signature, with `Line` now `{sku, qty}`:

```ts
placeOrder(baseUrl: string, email: string, lines: Line[]): Promise<Outcome<Order>>
```
