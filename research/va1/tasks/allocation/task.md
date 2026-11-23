Add an endpoint to set a budget allocation (percentages): `POST /allocations`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `ads` | integer | from 0 to 100 inclusive |
| `dev` | integer | from 0 to 100 inclusive |
| `ops` | integer | from 0 to 100 inclusive |
| `project` | string | 1 to 30 characters |

Across the three numbers, `ads + dev + ops` must be exactly 100.

Response `200`: the allocation, `{"ads": ..., "dev": ..., "ops": ..., "project": ...}`, with the values as sent.

Frontend: add `frontend/src/features/setAllocation.ts` exporting `setAllocation(baseUrl: string, input: { ads: number; dev: number; ops: number; project: string }): Promise<Outcome<{ ads: number; dev: number; ops: number; project: string }>>`.
