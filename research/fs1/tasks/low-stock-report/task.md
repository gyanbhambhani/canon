# Report the products that are low on stock

The shop wants to know which products to reorder.

**Backend:** add `GET /low-stock?below=<n>`.
- It returns one row per product whose `stock` is less than `below`, shaped `{"sku": ..., "name": ..., "stock": ...}` (only these three fields).
- Rows are sorted by `stock`, lowest first; products with the same stock are sorted by `sku`.
- No match is an empty list.
- Validation: `below` is between 1 and 1000 (both included). Anything else, or a missing or non-integer `below`, is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/lowStockReport.ts`, exporting

```ts
lowStockReport(baseUrl: string, below: number): Promise<Outcome<LowStock[]>>
```

where `LowStock` is `{ sku: string; name: string; stock: number }`. It returns the rows, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
