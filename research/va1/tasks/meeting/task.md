Add an endpoint to schedule a meeting within one day: `POST /meetings`. Times are minutes from midnight.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `title` | string | 1 to 60 characters |
| `start_hour` | integer | from 0 to 23 inclusive |
| `duration_min` | integer | from 15 to 240 inclusive, and a multiple of 15 |

The meeting must end by midnight: `start_hour * 60 + duration_min` is at most 1440.

Response `200`: the request body unchanged, `{"title": ..., "start_hour": ..., "duration_min": ...}`.

Frontend: add `frontend/src/features/scheduleMeeting.ts` exporting `scheduleMeeting(baseUrl: string, input: { title: string; start_hour: number; duration_min: number }): Promise<Outcome<{ title: string; start_hour: number; duration_min: number }>>`.
