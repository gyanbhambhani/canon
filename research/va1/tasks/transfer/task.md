Add an endpoint to make a transfer between accounts: `POST /transfers`. Amounts are whole cents. The sender's current balance is sent along with the request.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `from_account` | string | 1 to 20 characters |
| `to_account` | string | 1 to 20 characters, and different from `from_account` (case-sensitive comparison) |
| `amount` | integer | at least 1, and at most `balance` |
| `balance` | integer | at least 0 |

Response `200`: `{"from_account": ..., "to_account": ..., "amount": ..., "balance": ..., "remaining": balance - amount}`.

Frontend: add `frontend/src/features/makeTransfer.ts` exporting `makeTransfer(baseUrl: string, input: { from_account: string; to_account: string; amount: number; balance: number }): Promise<Outcome<{ from_account: string; to_account: string; amount: number; balance: number; remaining: number }>>`.
