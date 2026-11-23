Add an endpoint to create a temperature band: `POST /bands`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `low` | integer | from -50 to 50 inclusive |
| `high` | integer | from -50 to 50 inclusive, and at least 2 more than `low` (`high - low >= 2`) |
| `label` | string | at most 20 characters (may be empty) |

Response `200`: the band, `{"low": ..., "high": ..., "label": ...}`, with the values as sent.

Frontend: add `frontend/src/features/createBand.ts` exporting `createBand(baseUrl: string, input: { low: number; high: number; label: string }): Promise<Outcome<{ low: number; high: number; label: string }>>`.
