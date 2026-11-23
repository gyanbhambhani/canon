# Show a user's profile

**Backend:** add `GET /users/{email}`.
- It returns that user's profile, `{"email": ..., "name": ...}`, the same shape signing up returns.
- An unknown email is 400 with `{"error": {"kind": "NoSuchUser", "email": "<email>"}}`.

**Frontend:** add `frontend/src/features/getProfile.ts`, exporting

```ts
getProfile(baseUrl: string, email: string): Promise<Outcome<Profile>>
```

It returns the profile, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
