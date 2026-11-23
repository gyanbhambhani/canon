# Change an order's id from a number to a string

Order ids become strings of the form `"order-N"`: the first order placed is `"order-1"`, the second `"order-2"`, and so on.

- `POST /orders` returns the order with its new string id.
- `POST /orders/{id}/pay` takes the string id (for example `POST /orders/order-1/pay`). An unknown id is 400 with `{"error": {"kind": "Missing", "sku": "<the id given>"}}`.
- Everything that lists orders keeps its order (oldest first): `GET /orders/first`, `GET /summaries`, `GET /customers` and `GET /orders/open` behave as before.

**Frontend:** the `Order` type's `id` is a string, and `frontend/src/features/payOrder.ts` now has this signature:

```ts
payOrder(baseUrl: string, orderId: string): Promise<Outcome<Order>>
```
