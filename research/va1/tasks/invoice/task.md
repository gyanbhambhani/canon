Add an endpoint to submit an invoice: `POST /invoices`. Amounts are whole cents.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `number` | string | 1 to 20 characters |
| `subtotal` | integer | at least 0 |
| `tax` | integer | at least 0 |
| `shipping` | integer | at least 0 |
| `total` | integer | at least 0, and equal to `subtotal + tax + shipping` |

Response `200`: the invoice, `{"number": ..., "subtotal": ..., "tax": ..., "shipping": ..., "total": ...}`, with the values as sent.

Frontend: add `frontend/src/features/submitInvoice.ts` exporting `submitInvoice(baseUrl: string, input: { number: string; subtotal: number; tax: number; shipping: number; total: number }): Promise<Outcome<{ number: string; subtotal: number; tax: number; shipping: number; total: number }>>`.
