# FS-1 tasks, batch B (users and accounts): notes

18 tasks, 12 features and 6 changes. All 18 verify (`harness/verify.ts` prints PASS in the direct,
openapi and canon arms). None was dropped.

| Task | Kind | Validation spec | Canon agreement / hand-written |
| --- | --- | --- | --- |
| login-feature | feature | none (no rule added) | |
| get-profile | feature | none | |
| delete-account | feature | none | |
| list-users | feature | listUsers | 1 / 0.477 |
| change-password | feature | changePassword | 1 / 0.409 |
| user-addresses | feature | addAddress | 1 / 0.158 |
| default-address | feature | setDefaultAddress | 1 / 0.158 |
| change-email | feature | changeEmail | 1 / 0.396 |
| user-order-stats | feature | none | |
| search-users | feature | searchUsers | 1 / 0.413 |
| deactivate-user | feature | none | |
| password-reset-token | feature | resetPassword | 1 / 0.444 |
| rename-name-to-full-name | change | signup | 1 / 0.099 |
| add-required-phone | change | signup | 1 / 0.11 |
| tighten-password-rule | change | signup | 1 / 0.04 |
| split-signup | change | none (rule unchanged) | |
| add-required-terms-accepted | change | signup | 1 / 0.05 |
| name-to-first-last | change | signup | 1 / 0.119 |

## Specs shaped by Canon limits: read these first

Four specs were chosen so that a Canon reference can exist at all. Each is stated arm-neutrally in
its task.md and applies to every arm, but the owner may prefer to drop a task rather than keep a
spec shaped this way. All four come from two limits: an api fn's portable `requires` cannot look
at characters (finding 1 below), and a `requires` line cannot be longer than 100 characters
(finding 2).

- **tighten-password-rule.** A password under 12 characters is 422. A password with 12 or more
  characters and no digit is a domain error, 400 `WeakPassword`, not a 422. The checks run in this
  order: length, then digit, then Taken.
- **add-required-phone.** A missing `phone` is 422. A trimmed phone that is not an optional `+`
  followed by 7 to 15 digits is 400 `BadPhone`. Even a length-only 422 rule did not fit: the
  signup rule would be 102 characters or more.
- **name-to-first-last.** `last_name` is required in the body but may be empty, and `/customers`
  shows the first name alone in that case. Requiring both names to be non-empty makes the Canon
  `requires` line at least 108 characters long.
- **user-addresses and default-address.** The postcode needs at least 3 characters, with no upper
  bound. A 3-to-10 rule makes the `requires` line 125 characters long.

An agent in the Canon arm would hit the same walls with the stricter specs. So these choices
remove a source of Canon failures that the hand-written arms do not have, and the hand-written
arms lose nothing. The bias is small, but it favors Canon.

## Judgment calls

All are dated 2026-11-23.

- **The worktree started from an old commit.** Decision: I fast-forwarded the batch branch to
  main (685d41f) before writing anything. Reason: the FS-1 harness, starters and the 6 existing
  tasks exist only on main.
- **The direct and openapi backends.** Decision: each task's hand-written FastAPI change is
  written once and copied to both arms. The frontend features are written separately for each
  arm: `call()` with hand-kept `api/types.ts` for direct, openapi-fetch with `Schemas` for
  openapi, and `createClient` for canon. Reason: the two starters have byte-identical backends,
  and the existing tasks do the same. The Canon references were written in Canon, never
  translated.
- **Specs avoid the existing tasks.** Decision: no task changes the display name (that is
  change-display-name) or adds an age (signup-age). NoSuchUser `{email}` is reused as the
  unknown-user error everywhere, so the kinds stay consistent with change-display-name.
- **Login bodies in the change tasks.** Decision: in rename-name-to-full-name, add-required-phone,
  add-required-terms-accepted and name-to-first-last, `POST /login` gets its own body
  `{email, password}`, and other fields are ignored. Reason: the starter's login reuses the signup
  body, so changing signup would otherwise force the new fields into login. The ignored fields
  keep old clients working. tighten-password-rule and split-signup leave login's body alone.
- **login-feature.** Decision: the backend login body becomes `{email, password}` (other fields
  ignored, a missing field is 422), and a new `login` feature returns BadLogin as an error kind.
  It adds no validation rule, so there is no validation spec. Reason: the feature needs a
  backend part to be full-stack, and the unused `name` in the login body is the obvious defect.
- **get-profile.** Decision: `GET /users/{email}` returns the existing profile shape.
- **delete-account.** Decision: the route is `POST /users/{email}/delete` with a body
  `{"password"}`. NoSuchUser is checked before BadLogin, and orders placed with the email stay.
  Reason: in Canon a DELETE takes only query parameters, and a password should not travel in a
  URL.
- **list-users.** Decision: users are sorted by email in code-point order, and `per_page` is 1 to
  25. The client tests page through the whole list instead of assuming it is empty. Reason: one
  live server runs every client test, and Python, SQLite and Canon's sort_by all agree on
  code-point order.
- **change-password.** Decision: validation comes first (the new password has at least 8
  characters and differs from the old one), then NoSuchUser, then a new kind, `WrongPassword`.
  Reason: "differs" is a plain comparison, which Canon can express in `requires`.
- **search-users.** Decision: matching is a case-sensitive substring test against the trimmed
  `q`. The trimmed `q` needs at least 2 characters, and results are sorted by email. Reason:
  Canon has no lowercase built-in. With no string-contains built-in either, the Canon reference
  uses `len(split(text, part)) > 1`, a helper with its own test.
- **default-address.** Decision: one default shipping address per user, not a flag on
  user-addresses. Reason: every task starts from the starter, so default-address cannot build on
  user-addresses, and a copy of that table would duplicate it. GET returns JSON `null` when no
  address is set, and openapi-fetch handles that body.
- **change-email.** Decision: the error is `Taken` with the new email, including when the new
  email is the user's current one. The checks run in this order: 422, then NoSuchUser, then
  Taken. Orders keep the email they were placed with. The row order of `/customers` after a
  change is left unspecified and untested. Reason: Canon re-inserts the row under its new key,
  which moves it to the end. That is a legitimate implementation the task does not constrain.
- **user-order-stats.** Decision: the endpoint returns `{email, orders, spent}`, where `orders`
  counts every order and `spent` sums only the paid ones. An email with no account is
  NoSuchUser, even if it has orders.
- **deactivate-user.** Decision: login checks the password first, then Deactivated. Placing an
  order is Deactivated after the 422 for empty lines and before products are looked up.
  Deactivating twice is fine, and emails with no account can still order (the regression suite
  orders for bob@example.com). The Canon reference merges CatalogError and UserError into one
  `ShopError` in `canon/errors.cn`. Reason: a variant belongs to only one type in a project
  (finding 4), and both login and place_order must answer Deactivated.
- **password-reset-token.** Decision: tokens are uuids, kept in their own table and deleted when
  redeemed. A new token does not cancel older ones. Validation (new password of at least 8
  characters) runs before the token lookup, so a 422 does not use up a token.
- **split-signup.** Decision: `POST /users` returns `{email, token}`, and `POST /users/confirm`
  takes `{token}`. Login checks the password first, then NotConfirmed. `/customers` lists
  pending accounts too. Only test_signup_and_login and signup-probe are superseded; the other
  regression tests still pass as they are.
- **Superseded regression tests.** Decision: every change task lists each regression test whose
  expectation it breaks and re-checks that behavior in its own hidden tests. No superseded name
  is a prefix of another regression test.

## Compiler and language findings

None was fixed: packages/ is out of scope for this batch. Every reproduction runs with
`canon check --json` in a project (a folder with canon.toml), unless noted.

### 1. A `requires` cannot look at characters (language limit, A003)

The portable set has no string-contains or character test, and `split` is not allowed. So no
422 rule in Canon can test for "has a digit", "digits only" or "starts with +".

```
type Signup {
  password: String,
}

api fn signup(input: Signup) -> Bool
  route: POST "/users"
  requires: str_len(input.password) >= 12 && contains(split(input.password, ""), "1")
{
  return true
}
```

This gives `A003: api fn signup: its requires runs in the client too, so it cannot use a call to
split; ...`. The workaround is a check in the body that returns a domain error (400). That
workaround is why tighten-password-rule and add-required-phone have 400 errors.

### 2. A long `requires` has no fix (L001; extends COMPILER_ISSUES #1)

fmt never breaks a `requires` clause. It joins repeated `requires:` lines with `&&`, and it does
not break a list literal inside the clause either: `!contains([a, b, c], false)` gave a
161-character line. Signup cannot take a fourth string rule:

```
type Signup {
  email: String,
  first_name: String,
  last_name: String,
  password: String,
}

api fn signup(s: Signup) -> Bool
  route: POST "/users"
  requires: is_email(s.email) && trim(s.first_name) != "" && trim(s.last_name) != "" && str_len(s.password) >= 8
{
  return true
}
```

This gives L001 (112 characters) with no patch. It shaped the specs of name-to-first-last,
add-required-phone, user-addresses and default-address.

### 3. A forward reference inside Option breaks the generated Python

A record field `Option[T]`, where T is declared later in the file, generates `field: "T" | None`
in `canon_generated/models.py`. `canon check` passes, but importing the module raises
`TypeError: unsupported operand type(s) for |: 'str' and 'NoneType'`, so every request fails.

```
table users: User key email

type User {
  email: String,
  address: Option[Address],
}

type Address {
  street: String,
}
```

The workaround is to declare Address before User. A fix could emit `Optional["T"]`, quote the
whole annotation, or use `from __future__ import annotations`.

### 4. A variant name belongs to one type in the whole project

Two types, each with the variant `| Gone(email: String)`, give `T001 variant Gone is already
defined`. So two endpoints whose error types differ cannot share an error kind. The workaround is
one shared error type (deactivate-user's ShopError). This is a language design point, but it
forces an agent into a cross-module refactor.

### 5. fmt does not break a long record literal inside a match arm

For example:

```
Some(u) => Ok(f(u, Address { street: trim(a.street), city: trim(a.city), postcode: a.postcode })),
```

This is L001 (113 characters) with no patch, although the reference says fmt breaks long
statements at their brackets. The workaround is to bind the record with `let` before the match.

### 6. `return` is not allowed inside a match arm

```
var u = match o {
  Some(x) => x,
  None => return Err(E),
}
```

This is P001 ("expected an expression, found 'return'"). An early exit from a lookup has to be written
as nested matches, or with a helper that returns a Result and `try`. This is a language design
point, not a bug.

### 7. fmt rewrites nested calls into a one-line parenthesised pipeline

`len(filter(split(p, ""), |c| ...)) > 0` was rewritten into `(p |> split("") |> filter(...) |>
len()) > 0`, on one line. The reference says a pipeline has one stage per line. The workaround is
a `let` binding.

## Harness

No harness bugs were found. One note: `verify` runs `canon build` before the checks' `canon
check --fix`, so a reference must already be canonical (C001 stops the build). That is consistent
with the checklist ("Canon sources must be canonical").
