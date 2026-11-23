# Add a required age to signup

Signing up now requires the customer's age.

- `POST /users` takes a new required field, `age` (an integer). The existing rules still apply, and in addition `age` must be at least 13: otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`. A body without `age` is also 422.
- The profile includes the age: `{"email": ..., "name": ..., "age": ...}`, both from `POST /users` and from `POST /login`.
- `POST /login` keeps accepting the same body as before, `{"email": ..., "name": ..., "password": ...}`, with no age.

**Frontend:** `frontend/src/features/signup.ts` now has this signature, and sends the age:

```ts
signup(baseUrl: string, email: string, name: string, password: string, age: number): Promise<Outcome<Profile>>
```
