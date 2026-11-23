# FS-1 harness: decisions

Judgment calls made while building the harness, newest first. Each entry: date, decision, reason.

## 2026-11-23 — FS-1 pilot, power analysis and pre-registration
Decision: the pilot hit the ceiling for both frontier models (every arm 100% end-to-end pass), so
the pre-registration keeps the plan's primary analysis unchanged and adds first-round pass (the
hidden verdict right after the first edit round, recorded by the runner) as a secondary measure.
Reason: the difficulty check asks for tasks that are neither trivial nor impossible everywhere, and
there is no time overnight to author harder tasks. First-round pass varied in the pilot (Opus 50% to
88%, GPT 70% to 90% by arm), so it can still separate the arms. It cannot change the win rule.

Decision: margin 10 percentage points (the pre-set floor, because the pilot's paired differences have
no variance at the ceiling); runs per task 3 for gpt-6.2-sol and 2 for claude-opus-5-5 (the largest
R ≤ 3 whose projected cost stays within 90% of the $100 cap); Qwen 1 run per task if exploratory.
Reason: the power analysis rule in analysis/power.ts, applied to the pilot.

Decision: the baseline is openapi for both frontier models (both A and B scored 100% in the pilot;
a tie goes to B).
Reason: the plan calls B the arm that matters; the pre-registration fixed the tie rule before the
pilot was read.

Decision: GPT-6.2 Sol is priced at $2 / $10 per million input / output tokens, cached input $0.10,
from the CanonBench run's lookup (research/canonbench/runner/models.ts, 2026-11-22), and runs at
reasoning effort medium like CanonBench.
Reason: FS-1 needs a price for the $100 cap, and FS-1 and CanonBench should describe the same model
the same way.

Decision: when the provider account is out of credit, the runner records nothing for that run and
stops the model; the six Opus pilot runs that failed that way were removed from
results/pilot-claude.jsonl. A probe calls Opus about every 15 minutes and resumes it under the same
pre-registration if credit returns.
Reason: these are infrastructure failures, never wrong answers, and the main thread asked for them
to resume cleanly.

Decision: the runner gained `--concurrency` (several runs at once per model, each in its own working
copy) and `--cap` (stop launching runs at a model's recorded dollars across the pilot and main files).
Reason: 540 GPT runs one at a time would take about six hours.

## 2026-11-23 — The runner
Decision: one text protocol for every model (`<read/>`, `<write>`, `<run>check|test</run>`,
`<done/>`), not native tool calling. An edit round is a reply that writes files; after it the
harness builds, runs the arm's checks (fixes applied first) and the visible tests. Budget: 5 edit
rounds, 16 replies. The first message holds the task, the file list and every editable source
file; generated files (canon_generated, src/canon, schema.d.ts) are listed, not shown.
Reason: the local Qwen server has no reliable tool calling, and the same scaffold must serve all
three models. Showing the editable files up front spares every arm the same read turns.

Decision: sampling. Qwen 7B: temperature 0.2. claude-opus-5-5: effort medium (its default), no
temperature (the model rejects it), server-side refusal fallback. gpt-6.2-sol: provider defaults,
max_completion_tokens 16000. GPT-6.2 Sol's exact id, `gpt-6.2-sol`, comes from the OpenAI models
list on the key.
Reason: CanonBench fixes temperature 0.2 where a model accepts it. Opus 5.5 does not accept a
temperature, and FS-1's plan does not specify one.

Decision: dollars use Anthropic's list prices for claude-opus-5-5 ($4 / $20 per million input /
output tokens, cache reads $0.20, cache writes $5; Claude API reference, 2026-11). GPT-6.2 Sol has
no price source available to the harness, so its runs record tokens and `dollars: null` unless
FS1_PRICE_GPT_IN / FS1_PRICE_GPT_OUT are set.
Reason: no number is typed without a source.

Decision: the Canon arm's references are the built `/llms.txt` and `/llms-fullstack.txt`
(apps/web/out), 13,318 characters, recorded as referenceTokens = 3,794 (characters ÷ 3.5, the
repository's estimate). Actual input tokens are recorded from the API's usage as well.
Reason: the plan counts the reference against Canon's cost.

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

## 2026-11-23 — the task suite: 60 tasks (39 feature, 21 change), 10 adapted
Decision: the suite has 39 feature tasks and 21 change tasks rather than the plan's 40 and 20, because the first six tasks were split three and three. Ten tasks carry an `adapted` tag: their spec was narrowed so that a Canon reference could exist. The analysis reports every result with and without them.
Reason: rewriting a verified task only to restore an exact 40/20 split would add risk and no information. The adapted tasks document real expressiveness limits of Canon's portable validation subset: characters, list elements, values inside an Option, and long rules before the line-breaking fix.
