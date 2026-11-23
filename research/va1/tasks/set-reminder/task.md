Add an endpoint to set a reminder: `POST /reminders`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `minutes_before` | integer | from 5 to 1440 inclusive |
| `channel` | string | one of `email`, `sms`, `push` (exactly, lower case) |

Response `200`: the reminder, `{"minutes_before": ..., "channel": ...}`, with the values as sent.

Frontend: add `frontend/src/features/setReminder.ts` exporting `setReminder(baseUrl: string, input: { minutes_before: number; channel: string }): Promise<Outcome<{ minutes_before: number; channel: string }>>`.
