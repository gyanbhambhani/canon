# Search users by name

**Backend:** add `GET /users/search?q=<text>`.
- It returns the profiles, `[{"email": ..., "name": ...}, ...]`, of every user whose name contains `q` with surrounding whitespace trimmed. The match is case-sensitive: `"ace"` finds `"Grace"` but `"grace"` does not.
- The results are sorted by email (plain character order). No match is an empty list.
- Validation: the trimmed `q` has at least 2 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/searchUsers.ts`, exporting

```ts
searchUsers(baseUrl: string, q: string): Promise<Outcome<Profile[]>>
```

It returns the matching profiles, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
