# Show one order

Customers want to open a single order and see its lines, total and status.

**Backend:** add `GET /orders/{id}`.
- It returns the order with that id, in the same shape as `POST /orders` and `POST /orders/{id}/pay`.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- An id that is not an integer is 422 with `{"error": {"kind": "ValidationError", ...}}`.
- The existing `GET /orders/open` and `GET /orders/first` keep working as before.

**Frontend:** add `frontend/src/features/getOrder.ts`, exporting

```ts
getOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

It returns the order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
