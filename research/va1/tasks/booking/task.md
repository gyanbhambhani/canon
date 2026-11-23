Add an endpoint to book a stay: `POST /bookings`. Days are numbered from 0 (a stay from day 3 to day 5 is two nights).

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `guest` | string | not blank, at most 40 characters |
| `start` | integer | from 0 to 365 inclusive |
| `end` | integer | strictly after `start`, and the stay (`end - start`) is at most 30 nights |

Response `200`: `{"guest": ..., "start": ..., "end": ..., "nights": end - start}`.

Frontend: add `frontend/src/features/bookStay.ts` exporting `bookStay(baseUrl: string, input: { guest: string; start: number; end: number }): Promise<Outcome<{ guest: string; start: number; end: number; nights: number }>>`.
