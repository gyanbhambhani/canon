# Change an order's status to a string, and count orders by status

An order's `status` changes from a tagged object (`{"kind": "Open"}`, `{"kind": "Paid", "receipt": ...}`, `{"kind": "Cancelled"}`) to a plain string: `"open"`, `"paid"` or `"cancelled"`. The receipt moves to its own field, `receipt`: a string, or `null` until the order is paid.

- Every order the API returns (`POST /orders`, `POST /orders/{id}/pay`) has the new shape. A new order is `{"id": 1, "email": ..., "lines": [...], "total": 2209, "status": "open", "receipt": null}`; once paid it has `"status": "paid", "receipt": "test-receipt-2209"`.
- Add `GET /orders/count?email=<email>&status=<status>`: the number of that customer's orders with that status (an integer). `status` must be one of `"open"`, `"paid"` or `"cancelled"`: anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.
- `GET /orders/open?email=<email>` keeps working (the number of open orders), and so do `/summaries`, `/customers` and `/orders/first`.

**Frontend:** the `Order` type's `status` is a string (`"open" | "paid" | "cancelled"`) and it has `receipt: string | null`. `placeOrder` and `payOrder` keep their signatures. Add `frontend/src/features/countOrders.ts`, exporting

```ts
countOrders(baseUrl: string, email: string, status: string): Promise<Outcome<number>>
```

It returns the count, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
