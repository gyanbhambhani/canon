# VA-1 tasks: format and authoring checklist

Spec: docs/experiment-va1.md. Two worked examples: `gift-card` (set 1) and `booking` (set 2). Copy their
layout exactly. A task is a folder `tasks/<id>/`:

```text
task.json            id, set (1|2), title, adapted (null or {for, reason}), route, feature, base, random, rules
task.md              the prompt every arm sees (arm-neutral; CONVENTIONS.md is prepended by the runner)
hidden/test_http.py  pytest HTTP tests (fixture `client` is a TestClient on the arm's app)
reference/hand/      overlay on starters/hand:   backend/main.py (whole file), frontend/src/features/<module>.ts
reference/schema/    overlay on starters/schema: backend/models.py, backend/main.py, frontend/src/features/<module>.ts
reference/canon/     overlay on starters/canon:  canon/<name>.cn, frontend/src/features/<module>.ts
```

The overlay replaces whole files. Never write generated files (frontend/src/canon, backend/canon_generated,
schema.d.ts, schemas.json): they are rebuilt. Read starters/*/ to see what each arm provides
(`call`, `invalid`, and for schema `send` with a generated ajv validator).

## task.json: the near-boundary generator (harness/generator.ts, read its header)

- `base`: ordered draws of a VALID input (later fields may use `$earlier`). A string starting with `=` is a
  JS expression using `$field`, `int(a,b)`, `float(a,b)`, `pick([..])`, `alnum(n)`, `rep(s,n)`, `chance(p)`,
  `emoji(n)`; any other value is a constant. EVERY base draw must be valid under every rule.
- `random`: independent wide draws per field (mostly invalid inputs).
- `rules`: one entry per validation rule. `kind` is `single` (one field, fixed constraint) or `cross` (two or more
  fields, or a computation). `inside`: mutations `{"set": {field: value}}` that move to the EDGE of the rule and
  stay valid; `outside`: mutations that go past the edge by the smallest amount (1 for integers, 0.01 for
  two-decimal floats, one character for lengths, a near-miss for enums such as "usd" or "USD "). A mutation sets
  exactly the fields it names and must keep every OTHER rule satisfied (set related fields together, e.g.
  `{"end": "=$start + 31"}`), so each outside input breaks one rule only. Give 2 to 4 outside variants per rule
  and cover both sides of two-sided rules. Rules over the same fields should still have their own entry.
- `verify` checks the generator against the real servers: every base/inside input must get 2xx and every outside
  input must get 422, in all three arms.

## The contract and the Canon subset

Read `tasks/CONVENTIONS.md`. Request is one JSON body object (POST), 200 or 422 only, no domain errors, no
database. Field types: string, integer, float, boolean, list of strings. Responses echo the request (plus a
computed field where the task says so).

Canon's portable `requires` (runs in the client too) may use ONLY: comparisons, `+ - * / %`, `&& || !`, fields,
literals, `str_len`, `trim`, `contains(list, x)` (an enum is `contains(["a", "b"], r.f)`), `len(list)`,
`is_email`, `is_some`. It CANNOT: look at characters (no digit/pattern/substring/"starts with"/"contains"
test on strings), look inside list elements or an Option's value (no `unwrap_or`, no lambdas, no sum over a
list), so those rules are NOT used in any task (a scope limit, recorded in the report). Write `requires:` as one
clause with one conjunct per line, each continuation line starting with `&&` (see the examples: `canon fmt` then
accepts it, and a single conjunct must fit in 100 characters). Float arithmetic: `Float` ops need Float operands
(`to_float`). Use ints for money (cents). A name used in one `.cn` file must be unique across the project (every
task starts from the same starter, so only the starter's `Pong` and `ping` exist).

## Reference rules (the experiment's integrity)

- Write the three references INDEPENDENTLY and IDIOMATICALLY, as a careful engineer using that arm's tools
  would, never by translating one into another and never to force a particular agreement number.
  - hand: Pydantic models with plain types only (no `Field` constraints), checks written by hand in the route;
    client checks written by hand in the feature (use `[...s].length` or equivalent, since lengths count code points).
  - schema: EVERYTHING a JSON Schema can state goes in the Pydantic models (`Field(min_length, max_length, ge, le,
    gt, lt, multiple_of, pattern)`, `Literal[...]`, list `min_length/max_length`); the generated ajv validator then
    carries it to the client through `send(...)`. What a schema cannot state (rules over two fields, computed
    rules) is written by hand twice: a `@model_validator(mode="after")` in the model and the `extra` function
    passed to `send`. Use `pattern=r"[^ \t\r\n]"` for "not blank".
  - canon: one `api fn` with `requires:`.
- Do not sabotage or golf. If an idiomatic choice really differs between server and client, leave it; do not
  engineer a difference either.
- The hidden tests check status codes, `error.kind` and named response fields, never rule wording.
- Python must pass `ruff` and `mypy --strict`; TypeScript `tsc` and `eslint`; Canon `canon check` and `canon fmt`
  (verify runs all of them).
- Keep numbers small (below 2^53) and use only the four types above.

## Verify

```sh
cd research/va1 && npx tsx harness/verify.ts <id> [<id> ...]      # prints PASS/FAIL per arm with agreement
```

A task must print PASS for all three arms. If a reference cannot pass after honest effort, or Canon cannot
express a rule, change the rule (and set `adapted: {"for": "canon", "reason": ...}` if the spec was narrowed so
Canon could express it) or, failing that, drop the task and say so in `tasks/DROPPED.md` (id, reason). Record
compiler bugs in `research/va1/COMPILER_ISSUES.md` (append, minimal reproduction, workaround).
