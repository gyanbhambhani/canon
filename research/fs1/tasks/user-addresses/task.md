# Let users keep a list of addresses

Users can save shipping addresses to their account. Each address is a new stored record.

**Backend:**
- `POST /users/{email}/addresses` with the body `{"street": ..., "city": ..., "postcode": ...}` saves a new address for that user and returns it: `{"id": ..., "email": ..., "street": ..., "city": ..., "postcode": ...}`.
  - `id` is an integer: the first address saved is 1, the next 2, and so on, across all users.
  - `street` and `city` are saved with surrounding whitespace trimmed; `postcode` is saved as sent.
  - Validation: the trimmed street and the trimmed city are not empty, and the postcode has at least 3 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`. Validation comes before any other check.
- `GET /users/{email}/addresses` returns that user's addresses, oldest first (a user with none gets `[]`).
- On both routes, an email that has not signed up is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.

**Frontend:** add two feature modules (see `frontend/src/features/result.ts` for `Outcome`; they never throw):

`frontend/src/features/addAddress.ts`, exporting

```ts
addAddress(baseUrl: string, email: string, street: string, city: string, postcode: string): Promise<Outcome<Address>>
```

`frontend/src/features/listAddresses.ts`, exporting

```ts
listAddresses(baseUrl: string, email: string): Promise<Outcome<Address[]>>
```
