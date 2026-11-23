Add an endpoint to attach a note to an order: `POST /order-notes`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `note` | string | at most 200 characters (it may be empty) |
| `priority` | integer | from 0 to 9 inclusive |

Response `200`: the request body unchanged, `{"note": ..., "priority": ...}`.

Frontend: add `frontend/src/features/addOrderNote.ts` exporting `addOrderNote(baseUrl: string, input: { note: string; priority: number }): Promise<Outcome<{ note: string; priority: number }>>`.
