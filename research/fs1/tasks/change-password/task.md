# Let a user change their password

**Backend:** add `POST /users/{email}/password` with the body `{"old_password": "...", "new_password": "..."}`.
- Validation comes first: `new_password` has at least 8 characters and is different from `old_password`. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.
- If `old_password` is not the account's current password, answer 400 with `{"error": {"kind": "WrongPassword"}}` and change nothing.
- Otherwise it saves the new password and returns the profile, `{"email": ..., "name": ...}`. From then on, logging in works with the new password, and the old one gives `BadLogin`.

**Frontend:** add `frontend/src/features/changePassword.ts`, exporting

```ts
changePassword(baseUrl: string, email: string, oldPassword: string, newPassword: string): Promise<Outcome<Profile>>
```

It returns the profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
