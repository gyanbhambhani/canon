# Report paid revenue per customer

The shop wants to know how much money each customer has actually paid. `GET /summaries` counts every order; this report counts only paid ones.

**Backend:** add `GET /reports/revenue`.
- It returns one row per email that has at least one paid order (status kind `Paid`):
  `{"email": "<email>", "orders": <number of its paid orders>, "revenue": <the sum of their totals>}`.
- Orders that are not paid do not count, and an email with no paid order has no row.
- Rows are sorted by `revenue`, largest first; rows with the same revenue are sorted by `email`, alphabetically.
- With no paid orders, the report is an empty list.

**Frontend:** add `frontend/src/features/revenueReport.ts`, exporting

```ts
revenueReport(baseUrl: string): Promise<Outcome<Revenue[]>>
```

where `Revenue` is a new type for one row, named `Revenue`. It returns the rows, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
