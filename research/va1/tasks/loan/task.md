Add an endpoint to apply for a loan: `POST /loans`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `principal` | integer | from 1000 to 1000000 inclusive |
| `months` | integer | from 6 to 360 inclusive |
| `monthly_payment` | integer | from 1 to 1000000 inclusive, and the payments cover the principal: `monthly_payment * months >= principal` |

Response `200`: the request as sent, `{"principal": ..., "months": ..., "monthly_payment": ...}`.

Frontend: add `frontend/src/features/applyForLoan.ts` exporting `applyForLoan(baseUrl: string, input: { principal: number; months: number; monthly_payment: number }): Promise<Outcome<{ principal: number; months: number; monthly_payment: number }>>`.
