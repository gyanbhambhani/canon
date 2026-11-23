# Search products by name

Customers want to find products by typing part of a name.

**Backend:** add `GET /search?q=<text>`.
- It returns every product whose `name` contains `q`, as full product objects, sorted by `sku`.
- Matching ignores the case of the letters A to Z (`"apple"` finds `"Green APPLE"`); every other character, spaces included, must match exactly.
- No match is an empty list.
- Validation: `q` has at least 2 and at most 50 characters. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/searchProducts.ts`, exporting

```ts
searchProducts(baseUrl: string, query: string): Promise<Outcome<Product[]>>
```

It returns the matching products, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Product` type). It never throws.
