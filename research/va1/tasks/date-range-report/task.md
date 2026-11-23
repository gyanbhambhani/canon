Add an endpoint to request a report over a range of days of a month: `POST /reports/range`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `from_day` | integer | from 1 to 31 inclusive |
| `to_day` | integer | from 1 to 31 inclusive, and not before `from_day` |
| `granularity` | string | `day` or `week` (exactly, lower case); when the range is wider than 14 days (`to_day - from_day > 14`) it must be `week` |

Response `200`: the request as sent, `{"from_day": ..., "to_day": ..., "granularity": ...}`.

Frontend: add `frontend/src/features/requestReport.ts` exporting `requestReport(baseUrl: string, input: { from_day: number; to_day: number; granularity: string }): Promise<Outcome<{ from_day: number; to_day: number; granularity: string }>>`.
