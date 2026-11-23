# Give each user a default shipping address

Each user can have one default shipping address.

**Backend:**
- `PUT /users/{email}/default-address` with the body `{"street": ..., "city": ..., "postcode": ...}` sets that user's default address and returns it, `{"street": ..., "city": ..., "postcode": ...}`. Setting it again replaces the previous one.
  - `street` and `city` are saved with surrounding whitespace trimmed; `postcode` is saved as sent.
  - Validation: the trimmed street and the trimmed city are not empty, and the postcode has at least 3 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`. Validation comes before any other check.
- `GET /users/{email}/default-address` returns the user's default address, or `null` when none has been set.
- On both routes, an email that has not signed up is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.

**Frontend:** add two feature modules (see `frontend/src/features/result.ts` for `Outcome`; they never throw):

`frontend/src/features/setDefaultAddress.ts`, exporting

```ts
setDefaultAddress(baseUrl: string, email: string, street: string, city: string, postcode: string): Promise<Outcome<Address>>
```

`frontend/src/features/getDefaultAddress.ts`, exporting

```ts
getDefaultAddress(baseUrl: string, email: string): Promise<Outcome<Address | null>>
```
