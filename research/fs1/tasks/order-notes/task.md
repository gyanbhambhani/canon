# Add a note to an order

Customers can leave a short note on an order ("leave it at the back door"). The note is stored apart from the order: the order's own JSON does not change.

**Backend:** add two endpoints.
- `PUT /orders/{id}/note` with the body `{"note": "<text>"}` stores the note on the order, replacing any earlier note, and returns `{"id": <id>, "note": "<text>"}`. The note is stored exactly as given. It works for an order in any status.
  - Validation, checked first: the note is not blank (it has a character other than whitespace) and is at most 50 characters long. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.
  - An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- `GET /orders/{id}/note` returns `{"id": <id>, "note": "<text>"}`, with `"note": ""` when no note was set. An unknown order is 400 `Missing`, as above.

**Frontend:** add two feature modules:
- `frontend/src/features/setOrderNote.ts`, exporting

  ```ts
  setOrderNote(baseUrl: string, orderId: number, note: string): Promise<Outcome<OrderNote>>
  ```
- `frontend/src/features/getOrderNote.ts`, exporting

  ```ts
  getOrderNote(baseUrl: string, orderId: number): Promise<Outcome<OrderNote>>
  ```

`OrderNote` is a new type, `{id, note}`. Each returns the note, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
