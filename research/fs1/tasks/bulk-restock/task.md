# Restock several products at once

The warehouse sends one delivery for many products and wants to record it in one request.

**Backend:** add `POST /restock` with the body `{"items": [{"sku": "apple", "amount": 5}, ...]}`.
- Each item adds `amount` to that product's `stock`, as `PATCH /products/{sku}/stock` does for one product.
- The same SKU may appear in several items: its amounts add up.
- It returns the updated products, one per item, in the order of the items, each with its final stock (a SKU listed twice appears twice, both times with the same final stock).
- Validation: `items` has at least 1 and at most 20 entries. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.
- All or nothing: if any item fails, no stock changes at all. Items are checked in order and the first failing item decides the error:
  - an unknown SKU is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`;
  - otherwise, an `amount` that is not positive (0 or less) is 400 with `{"error": {"kind": "Invalid", "reason": "amount for <sku> is not positive"}}`.

**Frontend:** add `frontend/src/features/bulkRestock.ts`, exporting

```ts
bulkRestock(baseUrl: string, items: { sku: string; amount: number }[]): Promise<Outcome<Product[]>>
```

It returns the updated products, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Product` type). It never throws.
