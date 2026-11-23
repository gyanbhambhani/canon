Add an endpoint to sign up with a password: `POST /signup`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `email` | string | an email address: something, one `@`, something, a `.`, something (no spaces, and no `@` inside the parts) |
| `password` | string | at least 8 characters, and not exactly equal to `email` |

Response `200`: `{"email": ...}` (the password is never echoed).

Frontend: add `frontend/src/features/signUp.ts` exporting `signUp(baseUrl: string, input: { email: string; password: string }): Promise<Outcome<{ email: string }>>`.
