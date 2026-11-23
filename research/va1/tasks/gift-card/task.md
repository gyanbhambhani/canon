Add an endpoint to register a gift card: `POST /gift-cards`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `code` | string | 8 to 12 characters |
| `amount` | integer | from 5 to 500 inclusive |
| `currency` | string | one of `USD`, `EUR`, `GBP` (exactly, upper case) |

Response `200`: the registered card, `{"code": ..., "amount": ..., "currency": ...}`, with the values as sent.

Frontend: add `frontend/src/features/registerGiftCard.ts` exporting `registerGiftCard(baseUrl: string, input: { code: string; amount: number; currency: string }): Promise<Outcome<{ code: string; amount: number; currency: string }>>`.
