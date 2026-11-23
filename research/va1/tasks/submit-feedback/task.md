Add an endpoint to submit feedback: `POST /feedback`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `email` | string | a valid email address: one or more characters that are not `@` or whitespace, then `@`, then one or more such characters, a `.`, and one or more such characters (the whole string) |
| `message` | string | 10 to 1000 characters |
| `score` | integer | from 0 to 10 inclusive |

Response `200`: the request body unchanged, `{"email": ..., "message": ..., "score": ...}`.

Frontend: add `frontend/src/features/submitFeedback.ts` exporting `submitFeedback(baseUrl: string, input: { email: string; message: string; score: number }): Promise<Outcome<{ email: string; message: string; score: number }>>`.
