Add an endpoint to set the paging settings: `POST /settings/paging`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `size` | integer | from 10 to 100 inclusive |
| `sort` | string | one of `asc`, `desc` (lowercase, exact) |

Response `200`: the request body unchanged, `{"size": ..., "sort": ...}`.

Frontend: add `frontend/src/features/setPageSize.ts` exporting `setPageSize(baseUrl: string, input: { size: number; sort: string }): Promise<Outcome<{ size: number; sort: string }>>`.
