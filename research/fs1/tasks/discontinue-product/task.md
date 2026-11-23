# Discontinue a product

The shop wants to stop showing a product without deleting it.

**Backend:** add `POST /products/{sku}/discontinue`.
- It marks the product as discontinued and returns the product, as `GET /products/{sku}` does. The product's JSON shape does not change: there is no new field.
- Discontinuing a product that is already discontinued returns it again, with status 200.
- An unknown SKU is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.
- A discontinued product no longer appears in `GET /products`, with or without `tag`. Pages count only the products that are listed: page 1 with `per_page=2` holds the first two products that are not discontinued.
- `GET /products/{sku}` still returns a discontinued product.

**Frontend:** add `frontend/src/features/discontinueProduct.ts`, exporting

```ts
discontinueProduct(baseUrl: string, sku: string): Promise<Outcome<Product>>
```

It returns the discontinued product, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Product` type). It never throws.
