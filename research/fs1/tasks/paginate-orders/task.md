# Paginate a customer's orders

Customers want to see their orders, one page at a time.

**Backend:** add `GET /orders?email=<email>&page=<page>&per_page=<per_page>`.
- It returns the orders placed with that email, oldest first (by id), one page: page 1 is the first `per_page` orders.
- A page past the end is an empty list.
- Validation: `page` is at least 1, and `per_page` is between 1 and 20. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/listOrders.ts`, exporting

```ts
listOrders(baseUrl: string, email: string, page: number, perPage: number): Promise<Outcome<Order[]>>
```

It returns the page, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
