Add an endpoint to make a donation: `POST /donations`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `amount` | float | from 1.0 to 5000.0 inclusive |
| `currency` | string | one of `USD`, `EUR` (exactly, upper case) |
| `anonymous` | boolean | no rule |

Response `200`: the donation, `{"amount": ..., "currency": ..., "anonymous": ...}`, with the values as sent.

Frontend: add `frontend/src/features/donate.ts` exporting `donate(baseUrl: string, input: { amount: number; currency: string; anonymous: boolean }): Promise<Outcome<{ amount: number; currency: string; anonymous: boolean }>>`.
