Add an endpoint to set spending limits: `POST /limits`. The two limits are independent of each other.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `daily` | integer | from 1 to 1000 inclusive |
| `monthly` | integer | from 1 to 31000 inclusive |

Response `200`: the limits, `{"daily": ..., "monthly": ...}`, with the values as sent.

Frontend: add `frontend/src/features/setLimits.ts` exporting `setLimits(baseUrl: string, input: { daily: number; monthly: number }): Promise<Outcome<{ daily: number; monthly: number }>>`.
