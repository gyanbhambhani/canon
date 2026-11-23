Add an endpoint to subscribe to the newsletter: `POST /newsletter`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `email` | string | an email address: something, one `@`, something, a `.`, something (no spaces, and no `@` inside the parts) |
| `name` | string | not blank, at most 50 characters |

Response `200`: the subscription, `{"email": ..., "name": ...}`, with the values as sent.

Frontend: add `frontend/src/features/subscribeNewsletter.ts` exporting `subscribeNewsletter(baseUrl: string, input: { email: string; name: string }): Promise<Outcome<{ email: string; name: string }>>`.
