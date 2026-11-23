# Experiment VA-1: can the two sides disagree about what is valid?

Written 2026-11-23. A pre-registered experiment on Canon's one measured, model-independent
advantage: a validation rule is written once and enforced identically on the server and in the
client. It builds on Experiment FS-1 (docs/v0.5-fullstack.md) and reuses its starters, harness and
validation-agreement measure.

## Why this experiment

In FS-1's pilots, client and server agreed on what is valid for 100% of sampled inputs in the Canon
arm, against 43% (hand-written) and 59% (OpenAPI client). Pass rates were identical, so the result
is about the tool, not about how well a model writes code. The strongest objection:

> OpenAPI can carry validation too. Put the constraints in the Python models, and generate the
> TypeScript validators from the schema. Your OpenAPI arm just didn't do that.

VA-1 answers it. It adds that stronger baseline, and splits the validation rules into two kinds,
because the objection holds only for one of them.

- **Schema-expressible rules:** one field, a fixed constraint (non-empty, length range, numeric
  range, pattern, enum). JSON Schema can state them, so a schema-driven client can enforce them.
  Prediction: Canon ties the schema arm.
- **Cross-field and computed rules:** the rule depends on two or more fields, or on a computation
  (end after start; discount at most the subtotal; the password does not contain the email; the
  items add up to the total; at most N lines whose quantities sum to at most M). JSON Schema cannot
  state these. Prediction: the schema arm's client copy drifts from the server, and Canon does not.

## Arms (the same task, three ways)

| Arm | Server | Client validation |
| --- | --- | --- |
| **H. Hand-written** | FastAPI, hand-written checks | hand-written in TypeScript |
| **S. Schema-driven** | FastAPI with the constraints in the Pydantic models (`Field(min_length=..)`, `pattern`, `Literal`, ...) plus hand-written checks for what the schema cannot say | TypeScript validators **generated from the OpenAPI/JSON Schema** (e.g. Zod from `openapi-zod-client`, or `ajv` on the exported schema; pick one, pin it, record it), plus hand-written checks for what the schema cannot say |
| **C. Canon** | `api fn ... requires:`, compiled | the generated validator |

Arm S is the strongest conventional setup: everything a schema can carry is carried by the schema.
Whatever is left (the cross-field rules) must be written by hand, twice, exactly as in real
projects. Arm S's starter, its generator command and its conventions are written by the harness
author, not by the model under test, and are shown in the prompt.

## Tasks: 40, in two sets

- **Set 1, schema-expressible: 20 tasks.** Each adds an endpoint whose request has one to three
  fields with single-field rules (non-empty, bounded length, numeric range, enum, email-like
  pattern, optional-but-bounded). Example: "register a gift card: code 8 to 12 uppercase letters or
  digits, amount between 5 and 500, currency one of USD, EUR, GBP."
- **Set 2, cross-field or computed: 20 tasks.** Each adds an endpoint whose request has at least
  one rule that mentions two or more fields or a computation. Examples:
  - a booking whose end is after its start;
  - a coupon whose discount is at most the subtotal;
  - a signup whose password does not contain the email's local part;
  - an invoice whose line totals sum to the stated total;
  - a transfer whose source and destination differ and whose amount is at most the balance field sent
    with it;
  - a range filter whose min is at most its max, both optional.

  Each also has at least one single-field rule, so the task is realistic.

Every task has a Canon reference, a Hand-written reference and a Schema-driven reference, all
written idiomatically and independently, and all must pass the task's hidden tests. A rule that
Canon's portable subset cannot express (characters, list elements, values inside an Option) is
not used: those limits are known and listed in research/fs1/tasks/BATCH-*-NOTES.md. State that
exclusion in the report as a scope limit, not as a result.

## Hidden tests and metrics

For each task, per arm:

- **Validation agreement (primary).** On 1,000 seeded inputs per endpoint, the share where the
  client says valid exactly when the server answers 2xx and says invalid exactly when it answers
  422. The input generator is the harness's, and is the same for every arm. It must produce
  *near-boundary* inputs for each rule (just inside, just outside), because that is where drift
  hides: generate each input by taking a valid input and mutating one field or one relation to
  break a single rule by the smallest amount, plus the valid inputs themselves, plus random inputs.
- **Server correctness:** the hidden HTTP tests pass (this is the gate; an arm that fails them
  scores as not completed).
- **Client-says-valid, server-says-invalid** and **client-says-invalid, server-says-valid**, counted
  separately: the first sends a request that will bounce; the second blocks a legitimate request.
  Both are bugs; report each.
- **Agent metrics** (when a model writes the arm): end-to-end pass, edit rounds, tokens, dollars.

## Two phases

1. **References only (no model, free).** Run the three reference solutions through the harness
   on all 40 tasks. This measures the **tools' ceiling** by itself: how much of the agreement gap
   comes from what each arm can express, not from what any model writes. Report this first; it
   separates "Canon's design" from "agents are sloppy". Expect Set 1: S and C near 100%, H lower;
   Set 2: C at 100%, S and H lower.
2. **Agents write the arms.** Models: Qwen2.5-Coder 7B and 32B (local, free), GPT-6.2 Sol (paid,
   cap USD 20 for this experiment). Claude Opus 5.5 only if the owner has refilled the Anthropic
   account; the experiment does not need it. Three runs per task per arm per model on the local
   models; one run per task per arm on GPT unless the projection leaves room. Up to 5 edit rounds,
   the same toolchains as FS-1 (checks and fixes applied the same way in every arm).

## Analysis and pre-registration

- Unit: the task; paired across arms; 95% bootstrap intervals over tasks (seed 2026), 10,000
  resamples. One primary comparison, stated before running: **validation agreement, Canon minus
  Schema-driven, on Set 2**, per model. Everything else is exploratory.
- Outcomes: win (interval above 0), non-inferior (lower end above -0.03, i.e. 3 points, the same
  margin as the roadmap's equivalence margin), lose, inconclusive.
- Predictions, committed before the run: Set 1: Canon ties S (non-inferior, not a win); Canon beats H.
  Set 2: Canon beats S and H by a large margin. If Canon does not beat S on Set 2, say so: it would mean
  the stronger baseline closes the gap and the headline weakens to "Canon beats hand-written code".
- The input generator, the arm starters, the prompts, tool versions, the analysis script and the item
  hashes are committed with PREREGISTRATION.md before any model call. Rerun only infrastructure
  failures.
- Report with and without any adapted task (a task narrowed so Canon could express it), as in FS-1.

## Deliverable

research/va1/ with the starters (hand-written, schema-driven, canon), the 40 tasks, the harness
(reusing research/fs1/harness where possible), results/*.jsonl, PREREGISTRATION.md, the analysis
script and REPORT.md. The headline the experiment can support, if the predictions hold:

> Rules that a schema can state, a schema-driven client enforces as well as Canon does. Rules that
> a schema cannot state, which are the cross-field and computed rules real products are full of,
> drift between client and server when written twice, and are identical when written once in Canon.
