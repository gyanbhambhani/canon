Add an endpoint to add a contact: `POST /contacts`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `name` | string | 1 to 40 characters |
| `email` | string | either empty (`""`, meaning none) or a valid email address: `local@domain`, where `local` and `domain` contain no `@` and no whitespace (space, tab, CR, LF, vertical tab, form feed), `local` is not empty, and `domain` contains a `.` that is neither its first nor its last character |
| `phone` | string | either empty (`""`, meaning none) or 7 to 15 characters |

Across `email` and `phone`: at least one of them must be non-empty.

Response `200`: the contact, `{"name": ..., "email": ..., "phone": ...}`, with the values as sent.

Frontend: add `frontend/src/features/addContact.ts` exporting `addContact(baseUrl: string, input: { name: string; email: string; phone: string }): Promise<Outcome<{ name: string; email: string; phone: string }>>`.
