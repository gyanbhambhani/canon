Add an endpoint to filter products by price range: `POST /filters/price`. Prices are whole cents.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `min_price` | integer | at least 0, and at most `max_price` |
| `max_price` | integer | at least 0 |
| `category` | string | one of `food`, `drink`, `tool` (exactly, lower case) |

Response `200`: the filter, `{"min_price": ..., "max_price": ..., "category": ...}`, with the values as sent.

Frontend: add `frontend/src/features/filterByPrice.ts` exporting `filterByPrice(baseUrl: string, input: { min_price: number; max_price: number; category: string }): Promise<Outcome<{ min_price: number; max_price: number; category: string }>>`.
