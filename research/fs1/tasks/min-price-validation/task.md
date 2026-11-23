# A product costs at least one cent

Free products are no longer allowed in the catalog.

- `POST /products` now requires `cents` to be at least 1 (it used to accept 0). A product with `cents` of 0 or less is 422 with `{"error": {"kind": "ValidationError", ...}}`, and is not saved.
- The other rules are unchanged: the `sku` has at least 3 characters and `stock` is not negative.
- Nothing else changes: the request and response bodies keep their shape, and every other endpoint works as before.

**Frontend:** `frontend/src/features/addProduct.ts` keeps its signature:

```ts
addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>>
```

Adding a product with `cents` below 1 returns an error of kind `ValidationError`. It never throws.
