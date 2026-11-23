# Tighten the password rule for signup

New accounts need stronger passwords: at least 12 characters, with at least one digit (0 to 9).

`POST /users` (same body, same response) checks, in this order:
1. Validation: a valid email, a name that is not blank, and now a password of **at least 12 characters** (it was 8). Breaking any of these is 422 with `{"error": {"kind": "ValidationError", ...}}`.
2. A password with no digit `0`–`9` is 400 with `{"error": {"kind": "WeakPassword"}}`. For example, `"correct horse"` (13 characters, no digit) is now `WeakPassword`, and `"short1"` is 422.
3. An email that already has an account is 400 `Taken`, as before.

`POST /login` does not change.

**Frontend:** `frontend/src/features/signup.ts` keeps its signature:

```ts
signup(baseUrl: string, email: string, name: string, password: string): Promise<Outcome<Profile>>
```
