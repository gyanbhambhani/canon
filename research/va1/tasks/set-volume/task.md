Add an endpoint to set the speaker volume: `POST /volume`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `level` | integer | from 0 to 100 inclusive |

Response `200`: the request as sent, `{"level": ...}`.

Frontend: add `frontend/src/features/setVolume.ts` exporting `setVolume(baseUrl: string, input: { level: number }): Promise<Outcome<{ level: number }>>`.
