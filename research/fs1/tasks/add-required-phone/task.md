# Add a required phone number to signup

Signing up now requires a phone number.

- `POST /users` takes a new required field, `phone` (a string). A body without `phone` is 422 with
  `{"error": {"kind": "ValidationError", ...}}`. The existing rules still apply, also as 422.
- The phone is saved with surrounding whitespace trimmed. The trimmed phone must be an optional
  leading `+` followed by 7 to 15 digits (`0` to `9`), like `+4420794600` or `5550100200`. Any
  other phone is 400 with `{"error": {"kind": "BadPhone", "phone": "<the phone as sent>"}}`. This
  check comes after the 422 rules and before checking whether the email is taken.
- The profile includes the phone: `{"email": ..., "name": ..., "phone": ...}`, both from
  `POST /users` and from `POST /login`.
- `POST /login` needs only `email` and `password`; any other field in its body is ignored.

**Frontend:** `frontend/src/features/signup.ts` now has this signature, and sends the phone:

```ts
signup(baseUrl: string, email: string, name: string, password: string, phone: string): Promise<Outcome<Profile>>
```
