Add an endpoint to record that a user accepted the terms: `POST /terms`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `email` | string | a valid email address: `local@domain`, where `local` and `domain` contain no `@` and no whitespace (space, tab, CR, LF, vertical tab, form feed), `local` is not empty, and `domain` contains a `.` that is neither its first nor its last character |
| `accepted` | boolean | must be `true` |

Response `200`: `{"email": ..., "accepted": true}`, with the values as sent.

Frontend: add `frontend/src/features/acceptTerms.ts` exporting `acceptTerms(baseUrl: string, input: { email: string; accepted: boolean }): Promise<Outcome<{ email: string; accepted: boolean }>>`.
