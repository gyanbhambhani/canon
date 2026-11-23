# Product reviews

Customers can review a product: a rating from 1 to 5 and some text.

**Backend:**
- Add `POST /products/{sku}/reviews` with the body `{"rating": <int>, "text": <string>}`. It stores the review and returns it as `{"id": <int>, "sku": ..., "rating": ..., "text": ...}`.
  - `id` numbers reviews 1, 2, 3, … in the order they are written, across all products.
  - `text` is stored and returned exactly as sent (not trimmed).
  - Validation: `rating` is between 1 and 5; `text` is not blank (it has a character other than spaces, tabs and newlines) and has at most 500 characters. Anything else, or a body missing a field, is 422 with `{"error": {"kind": "ValidationError", ...}}`.
  - An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.
- Add `GET /products/{sku}/reviews`, which returns that product's reviews, oldest first (an empty list if it has none). An unknown product is 400 `Missing`, as above.

**Frontend:** add two feature modules:
- `frontend/src/features/addReview.ts`, exporting

  ```ts
  addReview(baseUrl: string, sku: string, rating: number, text: string): Promise<Outcome<Review>>
  ```

- `frontend/src/features/listReviews.ts`, exporting

  ```ts
  listReviews(baseUrl: string, sku: string): Promise<Outcome<Review[]>>
  ```

where a `Review` is `{ id: number; sku: string; rating: number; text: string }`. Each returns the value, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
