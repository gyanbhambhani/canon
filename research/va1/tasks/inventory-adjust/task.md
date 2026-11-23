Add an endpoint to remove units from stock: `POST /inventory/remove`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `on_hand` | integer | from 0 to 100000 inclusive |
| `remove` | integer | at least 1, and at most `on_hand` |
| `reason` | string | one of `sold`, `damaged`, `lost` (exactly, lower case) |

Response `200`: the request plus the stock left, `{"on_hand": ..., "remove": ..., "reason": ..., "left": on_hand - remove}`.

Frontend: add `frontend/src/features/removeStock.ts` exporting `removeStock(baseUrl: string, input: { on_hand: number; remove: number; reason: string }): Promise<Outcome<{ on_hand: number; remove: number; reason: string; left: number }>>`.
