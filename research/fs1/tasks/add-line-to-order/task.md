# Add a line to an open order

Customers can add products to an order until they pay for it.

**Backend:** add `POST /orders/{id}/lines`, whose body is a line: `{"sku": "<sku>", "quantity": <int>}`. It returns the updated order.
- If the order already has a line for that sku, that line's quantity grows by the quantity (the line keeps its position). Otherwise the new line is appended after the others.
- The order's `total` grows by the product's `cents` times the quantity. Every other field is unchanged.
- The request is checked in this order:
  1. `quantity` must be at least 1: otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.
  2. An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
  3. Only an open order (status `{"kind": "Open"}`) takes new lines: otherwise 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not open"}}`.
  4. An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`, as for placing an order.

**Frontend:** add `frontend/src/features/addLine.ts`, exporting

```ts
addLine(baseUrl: string, orderId: number, sku: string, quantity: number): Promise<Outcome<Order>>
```

It returns the updated order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
