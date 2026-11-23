# Remove a line from an open order

Customers can take a product out of an order until they pay for it.

**Backend:** add `DELETE /orders/{id}/lines/{sku}`. It returns the updated order, without the line for that sku.
- The order's `total` drops by the product's current `cents` times the removed line's quantity. Every other field, and the order of the remaining lines, is unchanged.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- Only an open order (status `{"kind": "Open"}`) can change: otherwise 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not open"}}`.
- If the order has no line for that sku: 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.
- An order keeps at least one line: removing its only line is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> would be empty"}}`.
- If the line's product no longer exists: 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.

**Frontend:** add `frontend/src/features/removeLine.ts`, exporting

```ts
removeLine(baseUrl: string, orderId: number, sku: string): Promise<Outcome<Order>>
```

It returns the updated order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
