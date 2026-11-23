# Show a user's order statistics

**Backend:** add `GET /users/{email}/stats`.
- It returns `{"email": ..., "orders": ..., "spent": ...}` for that user:
  - `orders` is the number of orders placed with that email, whatever their status;
  - `spent` is the sum of the totals of those orders that are paid (open and cancelled orders count as 0).
- A user with no orders gets `"orders": 0` and `"spent": 0`.
- An email that has not signed up is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`, even if orders were placed with it.

**Frontend:** add `frontend/src/features/getOrderStats.ts`, exporting

```ts
getOrderStats(baseUrl: string, email: string): Promise<Outcome<OrderStats>>
```

where `OrderStats` is the response's shape, `{email: string, orders: number, spent: number}`. It returns the statistics, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
