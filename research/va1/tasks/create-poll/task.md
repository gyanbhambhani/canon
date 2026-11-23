Add an endpoint to create a poll: `POST /polls`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `question` | string | 5 to 120 characters |
| `options` | list of strings | 2 to 6 entries (only the number of entries is checked, not the entries themselves) |

Response `200`: the poll, `{"question": ..., "options": ...}`, with the values as sent.

Frontend: add `frontend/src/features/createPoll.ts` exporting `createPoll(baseUrl: string, input: { question: string; options: string[] }): Promise<Outcome<{ question: string; options: string[] }>>`.
