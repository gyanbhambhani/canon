# Reorder

Customers can order again what they ordered before, with one click.

**Backend:** add `POST /orders/{id}/reorder` (no body). It places a new order, as `POST /orders` does, and returns it.
- The new order gets the next id, the same `email` and the same `lines` (same order, same quantities) as order `<id>`, and status `{"kind": "Open"}`.
- Its `total` is computed from the products' current `cents`, not copied from the old order.
- Any order can be reordered, whatever its status. The old order is unchanged.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- If one of the lines' products no longer exists: 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`, as for placing an order, and no order is created.

**Frontend:** add `frontend/src/features/reorder.ts`, exporting

```ts
reorder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

It returns the new order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
