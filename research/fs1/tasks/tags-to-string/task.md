# Change a product's tags from a list to one string

A product's `tags` field changes type: it was a list of strings, and it becomes one string of comma-separated tags, like `"tool,heavy"`. The empty string `""` means no tags. Tags are stored and returned exactly as sent.

- This applies to every request and response body that carries a product (`POST /products`, `GET /products/{sku}`, `GET /products`, `PATCH /products/{sku}/stock`). A product whose `tags` is a list is now 422 with `{"error": {"kind": "ValidationError", ...}}`.
- `GET /products?tag=<tag>` keeps filtering: a product matches when `<tag>` is exactly one of the comma-separated items of its `tags` (no trimming, so `"tool"` matches `"tool,heavy"` but not `"toolbox"` or `"tool ,heavy"`).
- Everything else (validation, orders, prices, reports) works as before.

**Frontend:** the project's `Product` type has `tags: string`. `frontend/src/features/addProduct.ts` and `frontend/src/features/listProducts.ts` keep their signatures:

```ts
addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>>
listProducts(baseUrl: string, tag: string | null, page: number, perPage: number): Promise<Outcome<Product[]>>
```
