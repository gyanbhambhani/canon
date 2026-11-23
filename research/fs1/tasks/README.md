# FS-1 tasks: format and authoring checklist

Each task is a folder `tasks/<id>/`:

```text
tasks/<id>/
  task.json             id, kind, title, features, supersedes?, validation?
  task.md               the prompt every arm sees (arm-neutral: no file paths except feature modules)
  hidden/test_http.py   pytest HTTP tests (optional; the `client` fixture is a TestClient on a fresh DB)
  hidden/client.test.ts client tests through the feature modules (exports `tests: ClientTest[]`)
  reference/direct/     overlay on starters/direct  (whole files; optional DELETE lists paths to remove)
  reference/openapi/    overlay on starters/openapi (the generated client is rebuilt, never in the overlay)
  reference/canon/      overlay on starters/canon   (Canon sources and features; generated code is rebuilt)
```

`task.json`:

```json
{
  "id": "paginate-orders",
  "kind": "feature",                       // or "change"
  "title": "One line",
  "features": [{ "module": "frontend/src/features/listOrders.ts",
                 "signature": "listOrders(baseUrl: string, email: string, page: number, perPage: number): Promise<Outcome<Order[]>>" }],
  "supersedes": ["test_orders", "order-and-pay-probe"],   // change tasks: regression tests they replace
  "validation": [{                                          // optional: validation agreement
    "feature": "listOrders",
    "args": [{ "name": "email", "gen": "email" }, { "name": "page", "gen": "small" }, { "name": "perPage", "gen": "small" }],
    "request": { "method": "GET", "path": "/orders", "query": { "email": "$email", "page": "$page", "per_page": "$perPage" } }
  }]
}
```

Generators (`harness/client-runner.ts`): `email`, `name`, `password`, `string`, `sku`, `int` (−50..149),
`small` (−5..14), `bool`. `$name` in `path`, `query` and `body` is replaced by the argument's value.
Samples whose path parameters would be empty, `.`, `..` or contain `/` are drawn again (no URL
carries them).

## Adapted tasks

A task whose spec was narrowed so that a Canon reference could exist at all carries
`"adapted": {"for": "canon", "reason": "..."}` in `task.json`. The narrowed spec applies to every
arm and is stated in `task.md`, but it removes a failure mode only the Canon arm had, so it leans
toward Canon. The pre-registered analysis reports every result with and without adapted tasks,
and the reasons are listed as Canon's expressiveness limits.

## The contract every arm keeps (starters/README.md has the details)

- `backend/main.py` exposes `app` and `reset_database()`; the database is `$SHOP_DATABASE`; payments
  are faked when `SHOP_FAKE_PAYMENTS=1`.
- Errors are `{"error": {"kind": ...}}`: 400 for domain errors, 422 `ValidationError` for invalid
  input, 500 `InternalError`.
- Feature modules live in `frontend/src/features/<name>.ts`, take `baseUrl` first, return
  `Promise<Outcome<T>>` (`frontend/src/features/result.ts`) and never throw.

## Tags and metrics

- HTTP tests are tagged `http` and `task` (or `regression` for `harness/regression/test_http.py`).
- Client tests are tagged `client`, plus what the test declares: `probe` marks a boundary probe (the
  server accepted what the client sent, and the client parsed what the server returned; compare the
  client's value with `t.http(...)` ground truth).
- End-to-end pass: every task and regression test passes. Mismatch: a `probe` failed. Change-task
  success: end-to-end pass on `kind: "change"`. Validation agreement: the client rejects an input
  before sending it exactly when the server answers 422, on 1,000 seeded inputs per spec. False
  acceptance: the arm's own checks pass (`harness/arms.ts` `checks`) but a hidden test fails.

## Authoring checklist

1. Write `task.md` arm-neutrally: behavior, routes, JSON shapes, status codes and error kinds, and
   the feature module's exact signature. Name no arm-specific files.
2. Hidden tests check behavior an agent can see in `task.md`, never an arm's wording (check
   `error.kind` and fields the task names, not validation `rule` text).
3. Client tests use `t.unique(...)` for every SKU and email: one live server runs all of them.
4. Add at least one `probe` per new or changed endpoint.
5. A change task lists in `supersedes` every regression test (pytest name or client id) whose
   expectations it changes, and its hidden tests check the new behavior instead. No superseded name
   may be a prefix of another regression test's name (pytest deselects by prefix).
6. Add a `validation` spec when the task adds or changes a validation rule.
7. Write the three references idiomatically for each arm, never derived from another arm. Canon
   sources must be canonical (`canon fmt`); Python passes ruff and mypy --strict; TypeScript passes
   tsc and eslint (the arm's checks run in verification).
8. `pnpm --filter canon-fs1 verify <id>` (or `npx tsx --conditions=source harness/verify.ts <id>`)
   must print PASS for all three arms. A task that does not verify is not used.
