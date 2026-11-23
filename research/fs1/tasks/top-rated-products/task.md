# Star ratings and the top-rated products

Customers can rate a product from 1 to 5 stars, and the home page lists the best-rated products.

**Backend:**
- Add `POST /products/{sku}/ratings` with the body `{"stars": <int>}`. It records one rating for the product and returns the product's rating summary, `{"sku": ..., "count": <int>, "average": <number>}`, including the new rating: `count` is the number of ratings of that product and `average` the exact mean of their stars (for example 4.5, or 4.333… for 5, 4 and 4).
  - Validation: `stars` is between 1 and 5. Anything else, or a body without `stars`, is 422 with `{"error": {"kind": "ValidationError", ...}}`.
  - An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.
- Add `GET /top-rated?limit=<n>`. It returns `[{"sku": ..., "name": ..., "average": <number>, "count": <int>}, ...]`, one row for each product that has at least one rating (products without ratings are left out), with `average` and `count` as above.
  - Order: highest `average` first; products with the same average are sorted by `sku`.
  - At most `limit` rows.
  - Validation: `limit` is between 1 and 20. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add two feature modules:
- `frontend/src/features/rateProduct.ts`, exporting

  ```ts
  rateProduct(baseUrl: string, sku: string, stars: number): Promise<Outcome<RatingSummary>>
  ```

  where a `RatingSummary` is `{ sku: string; count: number; average: number }`.
- `frontend/src/features/topRatedProducts.ts`, exporting

  ```ts
  topRatedProducts(baseUrl: string, limit: number): Promise<Outcome<TopRated[]>>
  ```

  where a `TopRated` is `{ sku: string; name: string; average: number; count: number }`.

Each returns the value, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
