Add an endpoint to create a discount, either a percentage or a fixed amount: `POST /discounts`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `percent` | integer | from 0 to 100 inclusive |
| `fixed_cents` | integer | from 0 to 100000 inclusive; exactly one of `percent` and `fixed_cents` is greater than 0 |
| `name` | string | 1 to 30 characters |

Response `200`: the request as sent, `{"percent": ..., "fixed_cents": ..., "name": ...}`.

Frontend: add `frontend/src/features/createDiscount.ts` exporting `createDiscount(baseUrl: string, input: { percent: number; fixed_cents: number; name: string }): Promise<Outcome<{ percent: number; fixed_cents: number; name: string }>>`.
