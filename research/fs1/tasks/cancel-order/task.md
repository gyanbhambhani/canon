# Add order cancellation

Customers can cancel an order they have not paid for yet.

**Backend:** add `POST /orders/{id}/cancel`.
- It returns the order with its status set to `{"kind": "Cancelled"}`; every other field is unchanged.
- Cancelling an order that is already cancelled returns it unchanged.
- An order that is paid cannot be cancelled: answer 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is paid"}}`.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.

**Frontend:** add `frontend/src/features/cancelOrder.ts`, exporting

```ts
cancelOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

It calls the new endpoint and returns the cancelled order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
