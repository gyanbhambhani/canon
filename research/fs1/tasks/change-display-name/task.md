# Let a user change their display name

**Backend:** add `PATCH /users/{email}` with the body `{"name": "<new name>"}`.
- It saves the new name with surrounding whitespace trimmed, and returns the profile, `{"email": ..., "name": ...}`.
- Validation: the trimmed name is not empty and has at most 40 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.
- Logging in afterwards returns the new name.

**Frontend:** add `frontend/src/features/changeDisplayName.ts`, exporting

```ts
changeDisplayName(baseUrl: string, email: string, name: string): Promise<Outcome<Profile>>
```

It returns the updated profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
