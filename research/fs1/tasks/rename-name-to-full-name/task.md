# Rename a user's `name` field to `full_name`

The user field `name` is renamed `full_name` everywhere: in the signup body, in the profile that
signing up and logging in return, in the frontend types and in the signup feature module. The
behavior does not change.

- `POST /users` takes `{"email": ..., "full_name": ..., "password": ...}`. The rules are the same as
  before, now on `full_name`: a valid email, a full name that is not empty after trimming, and a
  password of at least 8 characters. Otherwise 422 with `{"error": {"kind": "ValidationError", ...}}`.
  A body without `full_name` is also 422. The full name is saved trimmed.
- The profile is `{"email": ..., "full_name": ...}`, both from `POST /users` and from `POST /login`.
- `POST /login` needs only `email` and `password`; any other field in its body is ignored.
- `GET /customers` still returns `[full name, number]` pairs, as before.

After the change, no request or response uses the name `name` for a user.

**Frontend:** `frontend/src/features/signup.ts` keeps its parameters and sends `full_name`; the
`Profile` it returns has `full_name`:

```ts
signup(baseUrl: string, email: string, fullName: string, password: string): Promise<Outcome<Profile>>
```
