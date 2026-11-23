# Add a required shipping address to orders

Every order now needs an address to ship it to.

- `POST /orders` takes a new required field, `shipping_address` (a string): `{"email": ..., "lines": [...], "shipping_address": ...}`. The existing rules still apply, and in addition the address, after trimming leading and trailing spaces, must have at least 5 characters: otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`. A body without `shipping_address` is also 422. No order is created for a rejected request.
- Every order the API returns (`POST /orders`, `POST /orders/{id}/pay`) includes `shipping_address`, stored trimmed: `{"id": ..., "email": ..., "lines": [...], "shipping_address": "1 Main St", "total": ..., "status": ...}`.
- Everything else behaves as before: totals, paying, `/summaries`, `/customers`, `/orders/open` and `/orders/first`.

**Frontend:** the `Order` type has `shipping_address: string`, and `frontend/src/features/placeOrder.ts` now has this signature, and sends the address:

```ts
placeOrder(baseUrl: string, email: string, lines: Line[], shippingAddress: string): Promise<Outcome<Order>>
```
