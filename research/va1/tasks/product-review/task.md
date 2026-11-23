Add an endpoint to post a product review: `POST /reviews`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `rating` | integer | from 1 to 5 inclusive |
| `title` | string | 3 to 80 characters |

Response `200`: the review, `{"rating": ..., "title": ...}`, with the values as sent.

Frontend: add `frontend/src/features/postReview.ts` exporting `postReview(baseUrl: string, input: { rating: number; title: string }): Promise<Outcome<{ rating: number; title: string }>>`.
