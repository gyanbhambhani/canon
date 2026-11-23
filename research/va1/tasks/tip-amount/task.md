Add an endpoint to record a tip: `POST /tips`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `amount` | float (a JSON number, at most two decimals) | from 0.01 to 10000.0 inclusive |
| `percent` | integer | from 0 to 100 inclusive |

Response `200`: the request body unchanged, `{"amount": ..., "percent": ...}`.

Frontend: add `frontend/src/features/addTip.ts` exporting `addTip(baseUrl: string, input: { amount: number; percent: number }): Promise<Outcome<{ amount: number; percent: number }>>`.
