# List the products in a price range

Customers want to browse the products they can afford.

**Backend:** add `GET /price-range?min_cents=<min>&max_cents=<max>`.
- It returns every product whose `cents` is at least `min_cents` and at most `max_cents` (both ends included), as full product objects.
- The list is sorted by `cents`, cheapest first; products with the same price are sorted by `sku`.
- No match is an empty list.
- Validation: `min_cents` is not negative, and `max_cents` is at least `min_cents`. Anything else, or a missing or non-integer parameter, is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/productsInPriceRange.ts`, exporting

```ts
productsInPriceRange(baseUrl: string, minCents: number, maxCents: number): Promise<Outcome<Product[]>>
```

It returns the products, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Product` type). It never throws.
