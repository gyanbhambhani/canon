Add an endpoint to change a password: `POST /password`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `old_password` | string | at least 1 character |
| `new_password` | string | at least 8 characters, and different from `old_password` (compared exactly, case-sensitive) |
| `confirm` | string | equal to `new_password` |

Response `200`: `{"changed": true}`.

Frontend: add `frontend/src/features/changePassword.ts` exporting `changePassword(baseUrl: string, input: { old_password: string; new_password: string; confirm: string }): Promise<Outcome<{ changed: boolean }>>`.
