# Require accepting the terms at signup

Signing up now requires the customer to accept the terms of service.

- `POST /users` takes a new required field, `terms_accepted` (a boolean). It must be `true`: a
  body with `"terms_accepted": false`, or without `terms_accepted`, is 422 with
  `{"error": {"kind": "ValidationError", ...}}`. The existing rules still apply.
- The profile does not change: `{"email": ..., "name": ...}`.
- `POST /login` needs only `email` and `password`; any other field in its body is ignored.

**Frontend:** `frontend/src/features/signup.ts` now has this signature, and sends the flag:

```ts
signup(baseUrl: string, email: string, name: string, password: string, termsAccepted: boolean): Promise<Outcome<Profile>>
```
