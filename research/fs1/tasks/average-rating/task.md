# Star ratings and a product's average rating

Customers can rate a product from 1 to 5 stars, and the product page shows the average.

**Backend:**
- Add `POST /products/{sku}/ratings` with the body `{"stars": <int>}`. It records one rating for the product and returns the product's rating summary (below), including the new rating.
  - Validation: `stars` is between 1 and 5. Anything else, or a body without `stars`, is 422 with `{"error": {"kind": "ValidationError", ...}}`.
  - An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.
- Add `GET /products/{sku}/rating`, which returns the product's rating summary. An unknown product is 400 `Missing`, as above.
- A rating summary is `{"sku": ..., "count": <int>, "average": <number or null>}`: `count` is the number of ratings of that product, and `average` the exact mean of their stars (for example 4.5, or 4.333… for 5, 4 and 4), or `null` when the product has no ratings yet.

**Frontend:** add two feature modules:
- `frontend/src/features/rateProduct.ts`, exporting

  ```ts
  rateProduct(baseUrl: string, sku: string, stars: number): Promise<Outcome<RatingSummary>>
  ```

- `frontend/src/features/productRating.ts`, exporting

  ```ts
  productRating(baseUrl: string, sku: string): Promise<Outcome<RatingSummary>>
  ```

where a `RatingSummary` is `{ sku: string; count: number; average: number | null }`. Each returns the summary, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
