# Split a user's name into a first and a last name

A user's single `name` becomes two fields, `first_name` and `last_name`.

- `POST /users` takes `{"email": ..., "first_name": ..., "last_name": ..., "password": ...}`
  instead of `name`. Both names are saved with surrounding whitespace trimmed.
- Validation: a valid email, a password of at least 8 characters (as before), and a `first_name`
  that is not empty after trimming. `last_name` is required in the body but may be empty (some
  people have a single name). Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`; a
  body without `first_name` or without `last_name` is also 422.
- The profile is `{"email": ..., "first_name": ..., "last_name": ...}`, both from `POST /users`
  and from `POST /login`.
- `POST /login` needs only `email` and `password`; any other field in its body is ignored.
- `GET /customers` shows each customer's name as the first and last name joined by one space, or
  the first name alone when the last name is empty: `[["Ada Lovelace", 2], ["Plato", 3]]`.

After the change, no request or response uses the field `name` for a user.

**Frontend:** `frontend/src/features/signup.ts` now has this signature, and returns the new profile:

```ts
signup(baseUrl: string, email: string, firstName: string, lastName: string, password: string): Promise<Outcome<Profile>>
```
