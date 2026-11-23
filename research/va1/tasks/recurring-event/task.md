Add an endpoint to create a recurring event: `POST /events/recurring`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `interval_days` | integer | from 1 to 365 inclusive |
| `occurrences` | integer | from 1 to 52 inclusive |
| `title` | string | not blank |

Across both fields, the span `interval_days * occurrences` must be at most 365.

Response `200`: `{"interval_days": ..., "occurrences": ..., "title": ..., "span_days": interval_days * occurrences}`.

Frontend: add `frontend/src/features/createRecurring.ts` exporting `createRecurring(baseUrl: string, input: { interval_days: number; occurrences: number; title: string }): Promise<Outcome<{ interval_days: number; occurrences: number; title: string; span_days: number }>>`.
