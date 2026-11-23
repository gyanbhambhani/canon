Add an endpoint to set the age range of an event: `POST /events/ages`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `min_age` | integer | from 0 to 120 inclusive |
| `max_age` | integer | from 0 to 120 inclusive, and at least `min_age` |
| `title` | string | not blank, at most 60 characters |

Response `200`: the request body unchanged, `{"min_age": ..., "max_age": ..., "title": ...}`.

Frontend: add `frontend/src/features/setAgeRange.ts` exporting `setAgeRange(baseUrl: string, input: { min_age: number; max_age: number; title: string }): Promise<Outcome<{ min_age: number; max_age: number; title: string }>>`.
