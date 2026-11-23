# List the orders with one status

The shop's staff want to see every open order, every paid order, or every cancelled order.

**Backend:** add `GET /orders/by-status?status=<status>`.
- It returns every order whose status kind is `<status>`, oldest first (by id), in the same shape as `POST /orders` returns orders. No matching order is an empty list.
- Validation: `status` is exactly `Open`, `Paid` or `Cancelled` (the status kinds, with that case). Anything else, or a missing `status`, is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/listOrdersByStatus.ts`, exporting

```ts
listOrdersByStatus(baseUrl: string, status: string): Promise<Outcome<Order[]>>
```

It returns the orders, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type). It never throws.
