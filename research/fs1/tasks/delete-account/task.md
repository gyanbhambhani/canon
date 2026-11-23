# Let a user delete their account

**Backend:** add `POST /users/{email}/delete` with the body `{"password": "<the account's password>"}`.
- It deletes the account and returns the deleted profile, `{"email": ..., "name": ...}`.
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.
- A wrong password is 400 with `{"error": {"kind": "BadLogin"}}`, and the account stays.
- After deletion the account is gone: logging in gives `BadLogin`, `GET /customers` no longer lists it, and signing up again with the same email works. Orders placed with that email are not changed.

**Frontend:** add `frontend/src/features/deleteAccount.ts`, exporting

```ts
deleteAccount(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>>
```

It returns the deleted profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
