# Ship an order

Once an order is paid, the warehouse ships it and records a tracking number.

**Backend:** add `POST /orders/{id}/ship`, whose body is `{"tracking": "<tracking number>"}`.
- Orders get a new status, `{"kind": "Shipped", "tracking": "<tracking number>"}`. Shipping a paid order sets its status to that, with the tracking number trimmed of surrounding whitespace; every other field is unchanged. The shipped order is returned, and a later request sees it shipped.
- Validation: the tracking number must not be blank after trimming. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`; this is checked before the order is looked up.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- Only a paid order can be shipped. Any other order (open, cancelled, or already shipped) is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not paid"}}`.
- A shipped order is not open: `GET /orders/open` does not count it.

**Frontend:** add `frontend/src/features/shipOrder.ts`, exporting

```ts
shipOrder(baseUrl: string, orderId: number, tracking: string): Promise<Outcome<Order>>
```

It calls the new endpoint and returns the shipped order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type, whose status now includes `Shipped`). It never throws.
