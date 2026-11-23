# List users, one page at a time

**Backend:** add `GET /users?page=<page>&per_page=<per_page>`.
- It returns user profiles, `[{"email": ..., "name": ...}, ...]`, sorted by email (plain character order, so `"B@x.io"` comes before `"a@x.io"`), one page: page 1 is the first `per_page` users.
- A page past the end is an empty list.
- Validation: `page` is at least 1, and `per_page` is between 1 and 25. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** add `frontend/src/features/listUsers.ts`, exporting

```ts
listUsers(baseUrl: string, page: number, perPage: number): Promise<Outcome<Profile[]>>
```

It returns the page, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
