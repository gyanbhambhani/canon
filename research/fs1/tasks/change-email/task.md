# Let a user change their email

**Backend:** add `PATCH /users/{email}/email` with the body `{"new_email": "<new address>"}`.
- It moves the account to the new email and returns the profile, `{"email": <new email>, "name": ...}`. The name and the password stay the same: afterwards, logging in works with the new email, and the old email gives `BadLogin`.
- Orders keep the email they were placed with.
- Validation: `new_email` must be a valid email, by the same rule signup uses. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`. Validation comes before any other check.
- An unknown current email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.
- If any account already uses the new email (this one included), the answer is 400 with `{"error": {"kind": "Taken", "email": "<new email>"}}`, and nothing changes.

**Frontend:** add `frontend/src/features/changeEmail.ts`, exporting

```ts
changeEmail(baseUrl: string, email: string, newEmail: string): Promise<Outcome<Profile>>
```

It returns the updated profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
