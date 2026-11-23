# An open-order badge for a user

The account menu shows a badge with how many of a user's orders are still open.

**Backend:** add `GET /users/{email}/badge`. It returns `{"email": "<email>", "open": <n>, "label": "<label>"}`:
- `open` is the number of orders placed with that email whose status is `{"kind": "Open"}`.
- `label` is `"No open orders"` for 0, `"1 open order"` for 1, `"<n> open orders"` for 2 to 9 (for example `"3 open orders"`), and `"9+ open orders"` for 10 or more.
- The email must belong to a signed-up user (`POST /users`): otherwise 400 with `{"error": {"kind": "NoUser", "email": "<email>"}}`. (Orders can be placed with any email; a badge is only for users.)

**Frontend:** add `frontend/src/features/orderBadge.ts`, exporting

```ts
orderBadge(baseUrl: string, email: string): Promise<Outcome<Badge>>
```

where `Badge` is the type of the response above, named `Badge`. It returns the badge, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
