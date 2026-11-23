# A product's stock may be unknown

Some suppliers do not tell the shop how many items it has. A product's `stock` becomes optional: an integer, or `null`, which means the stock is unknown.

- Everywhere a product is sent or returned (`POST /products`, `GET /products/{sku}`, `GET /products`, `PATCH /products/{sku}/stock`), `stock` is an integer or `null`. The key is always present.
- `POST /products` accepts `"stock": null` and saves it; reading the product back gives `"stock": null`.
- `PATCH /products/{sku}/stock` on a product whose stock is unknown sets its stock to the amount (`null` plus 5 is 5). A known stock still grows by the amount.
- Validation: the `sku` has at least 3 characters and `cents` is not negative, as before (422 with `{"error": {"kind": "ValidationError", ...}}` otherwise).
- A known stock below zero is now a domain error rather than a validation error: 400 with `{"error": {"kind": "Invalid", "reason": "stock is negative"}}`, and the product is not saved. A stock of 0 is fine.
- Nothing else changes.

**Frontend:** the project's `Product` type has `stock: number | null`. `frontend/src/features/addProduct.ts` and `frontend/src/features/listProducts.ts` keep their signatures and must send and return products whose stock is `null`:

```ts
addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>>
listProducts(baseUrl: string, tag: string | null, page: number, perPage: number): Promise<Outcome<Product[]>>
```
