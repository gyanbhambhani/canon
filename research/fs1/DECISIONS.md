# FS-1 harness: decisions

Judgment calls made while building the harness, newest first. Each entry: date, decision, reason.

## 2026-11-23 — Six tasks: three features, three changes
Decision: the six tasks written now are cancel-order, paginate-orders and change-display-name
(features), and rename-product-cents, signup-age and order-id-string (changes).
Reason: the brief asked for "4 feature, 2 change" but listed six examples from the plan, three of
each kind; the examples are the more specific instruction. The remaining 54 restore the plan's
40/20 split (37 more features, 17 more changes).

## 2026-11-23 — The starters' frontends are TypeScript libraries, without React
Decision: each arm's frontend is `src/` with its API layer and `src/features/*.ts` feature modules.
Hidden client tests import the feature modules in Node. The React UI of examples/shop is not part of
the starters.
Reason: FS-1's hidden tests exercise "a small frontend module that uses" the endpoint, not a UI. A
UI would add work for agents without being measured, and Playwright per run would slow the runs
down a lot.

## 2026-11-23 — One arm-neutral contract
Decision: every arm's `backend/main.py` exposes `app` and `reset_database()`, reads
`$SHOP_DATABASE`, and fakes payments when `SHOP_FAKE_PAYMENTS=1`. Every feature takes `baseUrl` first
and returns `Outcome<T>` (`{ok: true, value} | {ok: false, error: {kind}}`), never throwing. Hidden
tests check status codes, error kinds and named fields, never validation `rule` wording.
Reason: one test suite must serve all three arms. Rule text is naturally different between a
hand-written backend and Canon.

## 2026-11-23 — The starter removes `rename` (PUT /users/{email})
Decision: the Canon starter is examples/shop without its `rename` endpoint, and the hand-written
backends never had it.
Reason: "let a user change their display name" is one of the tasks.

## 2026-11-23 — The direct backend is idiomatic, not a translation
Decision: backend/shop is a hand-written FastAPI app (routers per area, SQLite with real columns,
`str.strip()`, a regex for emails, hashlib for passwords). It matches the Canon backend's wire
contract and the regression suite, but not its internals.
Reason: the plan forbids generating the baseline from Canon. Small differences that a careful
engineer would make (for example `strip` treating more characters as whitespace) are real and stay.

## 2026-11-23 — The OpenAPI arm's client
Decision: arm B generates `frontend/src/api/schema.d.ts` with openapi-typescript 7.13.0 from the
FastAPI app's own schema (`node generate-client.mjs`), and calls it through openapi-fetch 0.17.0,
both pinned.
Reason: the most common way teams keep a TypeScript client in step with FastAPI today.

## 2026-11-23 — Every arm gets tsc and eslint for its frontend
Decision: the canon arm's checks are `canon check --json` (after `--fix --write`), `canon test`,
and `tsc --noEmit` and `eslint` on its frontend. The direct and openapi arms get ruff (fixes
applied), `mypy --strict`, and the same tsc and eslint.
Reason: every arm writes a TypeScript feature module, so a TypeScript checker belongs in every arm.
FS-1's table lists only the Canon-specific checks for arm C.

## 2026-11-23 — The regression suite is visible; task tests are hidden
Decision: harness/regression (12 HTTP and 5 client tests of the starter's behavior) is the
starters' visible test suite and also part of every hidden run. Each task's own tests stay hidden.
Reason: the plan gives agents "the starter's visible tests" and requires "the full regression
suite" among the hidden tests; regression tests only describe existing behavior.

## 2026-11-23 — Validation agreement counts client-side rejection
Decision: for each of 1,000 seeded inputs, the client "rejects" when the feature returns a
`ValidationError` without making any request; the server "rejects" when it answers 422. Agreement
is the share of inputs where both say the same.
Reason: the plan's metric is whether the client and server agree on what is valid. A client that
does not validate sends everything, so it agrees only where the server accepts. The six references
show it: the hand-written arms score 0.07 to 0.60, and Canon 1.0.

## 2026-11-23 — Separate Python environment
Decision: research/fs1/.venv (requirements.txt: the root pins plus pytest 8.4.2).
Reason: the root requirements-dev.txt has no pytest, and the brief limits edits to research/fs1.
