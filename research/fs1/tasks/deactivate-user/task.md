# Deactivate a user

An administrator can deactivate an account. A deactivated user can no longer log in or place orders.

**Backend:** add `POST /users/{email}/deactivate` (no body).
- It marks the account deactivated and returns its profile, `{"email": ..., "name": ...}`. Deactivating an account that is already deactivated returns the profile again (200).
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.

After deactivation:
- `POST /login` still checks the password first: a wrong password is 400 `{"error": {"kind": "BadLogin"}}` as before. With the right password, it is 400 with `{"error": {"kind": "Deactivated", "email": "<email>"}}`.
- `POST /orders` with the email of a deactivated account is 400 with `{"error": {"kind": "Deactivated", "email": "<email>"}}`, and no order is created. This check comes before the products are looked up (an order with an empty `lines` list is still 422). Orders for emails that have no account keep working as before.
- Signing up again with that email is still 400 `Taken`.

**Frontend:** add `frontend/src/features/deactivateUser.ts`, exporting

```ts
deactivateUser(baseUrl: string, email: string): Promise<Outcome<Profile>>
```

It returns the profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
