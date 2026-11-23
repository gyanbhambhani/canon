# Paying takes stock

Paying for an order should take its items out of stock, and must not sell what the shop does not have.

**Backend:** change `POST /orders/{id}/pay`.
- Before charging, every line's product must have at least the line's quantity in stock. If one does not, answer 400 with `{"error": {"kind": "OutOfStock", "sku": "<sku>", "available": <the product's stock>}}` for the first such line (in the order's line order). Nothing is charged and nothing changes: the order stays open and every stock stays as it was.
- When the payment succeeds, each line's quantity is taken from its product's stock (`GET /products/{sku}` shows the lower stock), and the order is paid as before: its status is `{"kind": "Paid", "receipt": "<receipt>"}`.
- A paid order cannot be paid again: 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is paid"}}`. Nothing is charged and no stock changes.
- A line whose product no longer exists is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`, and nothing changes.
- An unknown order is still 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`.

**Frontend:** `frontend/src/features/payOrder.ts` keeps its signature,

```ts
payOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

and its errors now include `OutOfStock`, with its `sku` and `available` fields. It never throws.
