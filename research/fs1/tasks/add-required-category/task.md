# Add a required category to products

Every product now has a category.

- `Product` gets a new required field, `category` (a string), in every request and response body that carries a product (`POST /products`, `GET /products/{sku}`, `GET /products`, `PATCH /products/{sku}/stock`). The category is stored and returned exactly as sent.
- Validation: the category must not be blank, that is, it must have at least one character that is not whitespace. A blank category, or a product body without `category`, is 422 with `{"error": {"kind": "ValidationError", ...}}`. The existing rules still apply.
- Everything else (orders, prices, reports) works as before.

**Frontend:** the project's `Product` type gets `category: string`, and `frontend/src/features/addProduct.ts` keeps its signature and sends the category:

```ts
addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>>
```

`listProducts` returns products with their category.
