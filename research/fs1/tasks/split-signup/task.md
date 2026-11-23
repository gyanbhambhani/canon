# Split signup into register, then confirm

Signing up now takes two steps: registering creates a pending account, and confirming it with a token makes it usable.

- `POST /users` keeps its body (`{"email": ..., "name": ..., "password": ...}`) and its validation rules (422 `ValidationError`) and its `Taken` error. It now creates a **pending** account and returns `{"email": ..., "token": ...}`, where the token is a new random UUID (the 36-character form). Signing up again with the email of a pending account is still 400 `Taken`.
- New: `POST /users/confirm` with the body `{"token": ...}` confirms the account that token belongs to, and returns its profile, `{"email": ..., "name": ...}` (the name trimmed, as before). A token works once: an unknown token, or one already used, is 400 with `{"error": {"kind": "BadToken"}}`.
- `POST /login` (same body as before) checks the password first: a wrong password or unknown email is 400 `{"error": {"kind": "BadLogin"}}` as before. A pending account with the right password is 400 with `{"error": {"kind": "NotConfirmed"}}`. A confirmed account logs in and gets its profile, as before.
- `GET /customers` lists every account, pending or confirmed, as before.

**Frontend:** `frontend/src/features/signup.ts` keeps its parameters but now returns the pending account:

```ts
signup(baseUrl: string, email: string, name: string, password: string): Promise<Outcome<{ email: string; token: string }>>
```

Add `frontend/src/features/confirmSignup.ts`, exporting

```ts
confirmSignup(baseUrl: string, token: string): Promise<Outcome<Profile>>
```

Both return the value or the error (see `frontend/src/features/result.ts` for `Outcome`), and never throw.
