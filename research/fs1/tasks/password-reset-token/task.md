# Reset a forgotten password with a one-time token

**Backend:** add two endpoints.

`POST /users/{email}/reset` (no body) issues a reset token for that account.
- It returns `{"token": "<token>"}`, where the token is a new random UUID (the 36-character form, like `"6f1c2d3e-..."`). Every call issues a new token.
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.

`POST /password-resets` with the body `{"token": ..., "new_password": ...}` redeems a token.
- Validation comes first: `new_password` has at least 8 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.
- It sets the account's password to `new_password` and returns its profile, `{"email": ..., "name": ...}`. Afterwards `POST /login` accepts the new password, and the old one is 400 `BadLogin`.
- A token works once. An unknown token, or one already redeemed, is 400 with `{"error": {"kind": "BadToken"}}`. Redeeming one token does not affect other tokens.

**Frontend:** add two feature modules (see `frontend/src/features/result.ts` for `Outcome`; neither throws):

`frontend/src/features/requestPasswordReset.ts`, exporting

```ts
requestPasswordReset(baseUrl: string, email: string): Promise<Outcome<{ token: string }>>
```

`frontend/src/features/resetPassword.ts`, exporting

```ts
resetPassword(baseUrl: string, token: string, newPassword: string): Promise<Outcome<Profile>>
```
