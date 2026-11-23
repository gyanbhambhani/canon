Add an endpoint to report a bug: `POST /bugs`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `title` | string | 5 to 100 characters |
| `severity` | integer | from 1 to 4 inclusive |
| `steps` | list of strings | at most 10 entries (the entries themselves have no rule; the list may be empty) |

Response `200`: the report, `{"title": ..., "severity": ..., "steps": [...]}`, with the values as sent.

Frontend: add `frontend/src/features/reportBug.ts` exporting `reportBug(baseUrl: string, input: { title: string; severity: number; steps: string[] }): Promise<Outcome<{ title: string; severity: number; steps: string[] }>>`.
