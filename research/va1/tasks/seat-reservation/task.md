Add an endpoint to reserve a block of adjacent seats in a row of 20 seats: `POST /seats/reserve`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `seats` | integer | from 1 to 10 inclusive |
| `row` | integer | from 1 to 30 inclusive |
| `first_seat` | integer | from 1 to 20 inclusive, and the block fits in the row: `first_seat + seats - 1 <= 20` |

Response `200`: the request as sent, `{"seats": ..., "row": ..., "first_seat": ...}`.

Frontend: add `frontend/src/features/reserveSeats.ts` exporting `reserveSeats(baseUrl: string, input: { seats: number; row: number; first_seat: number }): Promise<Outcome<{ seats: number; row: number; first_seat: number }>>`.
