# Log in from the frontend

The backend already has `POST /login`, but the frontend has no way to call it, and the endpoint
still asks for a `name` it never uses.

**Backend:** `POST /login` takes the body `{"email": ..., "password": ...}`.
- `name` is no longer needed. Any other field in the body is ignored, so a body that still sends `name` keeps working.
- A correct email and password return the profile, `{"email": ..., "name": ...}`, as before.
- An unknown email or a wrong password is 400 with `{"error": {"kind": "BadLogin"}}`, as before.
- A body without `email` or `password` is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/login.ts`, exporting

```ts
login(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>>
```

It returns the profile, or the error (see `frontend/src/features/result.ts` for `Outcome`): a failed
login is an error whose `kind` is `"BadLogin"`. It never throws.
