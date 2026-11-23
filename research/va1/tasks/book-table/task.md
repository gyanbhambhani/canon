Add an endpoint to book a table: `POST /tables/book`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `party_size` | integer | from 1 to 12 inclusive |
| `name` | string | not blank, at most 40 characters |

Response `200`: the request body unchanged, `{"party_size": ..., "name": ...}`.

Frontend: add `frontend/src/features/bookTable.ts` exporting `bookTable(baseUrl: string, input: { party_size: number; name: string }): Promise<Outcome<{ party_size: number; name: string }>>`.
