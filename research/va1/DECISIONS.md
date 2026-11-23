# VA-1: decisions

Judgment calls, newest first. Each entry: date, decision, reason. All dated 2026-11-23.

## Scope cuts by the coordinator (before any model call)
Decision: no paid model is run. The Anthropic and OpenAI accounts are both out of credit, so GPT-6.2 Sol
(the spec's paid model, cap USD 20) was NOT run; a GPT call that fails for credit would be an
infrastructure failure and record nothing, and the runner refuses non-local models. Qwen2.5-Coder-32B
was also dropped: three weight downloads failed, so port 8092 is not used and is not waited on. Phase 2
is Qwen2.5-Coder-7B-Instruct-8bit on port 8091 only (CanonBench's server; VA-1 never starts a server).
Reason: the coordinator's instructions. Recorded as Amendment 1 in PREREGISTRATION.md before the first
Qwen call. To run GPT-6.2 Sol the owner would refill the OpenAI account (about USD 20 under the cap).

## The harness is copied from FS-1, not imported
Decision: harness/arms.ts, hidden.ts, client-runner.ts, runner/run.ts and models.ts are adapted copies
of research/fs1's; research/fs1 is not edited. Reason: the arms, contract (stateless service, no
database) and measure (near-boundary inputs, per-category counts, bounce/block split) differ.

## The branch was fast-forwarded to main
Decision: `git merge --ff-only main` at the start. Reason: the worktree began at an old commit that had
neither research/fs1 nor the compiler's full-stack support; main has both.

## The service has no database; every endpoint is 200 or 422
Decision: a stateless "forms" service; each task adds one POST endpoint and one feature module. The
hidden gate is the HTTP tests plus a client wiring check (a valid input is accepted by the client after
exactly one request and returns what the server returns). Reason: the experiment measures validation
agreement; domain errors and storage would add failure modes unrelated to it.

## The schema arm: Pydantic -> OpenAPI -> openapi-typescript 7.13.0 (types) and ajv 8.17.1 (validators)
Decision: `node generate-client.mjs` exports FastAPI's OpenAPI schema, writes schema.d.ts and
schemas.json; `validate.ts` (harness-authored) compiles each Pydantic model's schema with ajv (strict
off); `send()` in client.ts runs the validator, then a hand-written `extra` check, then fetches. Zod
via openapi-zod-client was not used: it drops some keywords, and ajv enforces the exported schema
as stated. harness/schema-enforcement.ts checks the chain on a probe model with every constraint kind
(min/max length, pattern, ge/le/gt/lt, multiple_of, Literal, Literal[True], list length): 49 inputs, 0
disagreements (results/schema-enforcement.json).

## Canon's portable subset limits the rules (a scope limit, not a result)
Decision: no task uses a pattern (characters), a per-element list rule, or a rule on a value inside an
Option; these cannot be Canon `requires` (BATCH-A/B/C notes). Set 1 therefore has no pattern tasks
(the spec's own gift-card example keeps only the code's length, tagged adapted); "both optional"
bounds are required in range-filter (adapted); "password does not contain the email's local part" is
"password differs from the email" (adapted); "invoice lines sum to the total" is four fixed fields
(adapted). This limits what Set 1 can show: it favors a tie.

## Task authoring was delegated, and files were partly generated
Decision: four sub-agents wrote the 38 tasks after I wrote two exemplars. Some (batches B to D) emitted
files with throwaway scripts outside the repo; each arm's reference was still written separately per
arm as the checklist demands, but they share a template of authorship, so the three references of a
task are less independent than the spec asks. Every reference was verified (PASS all arms). Reason:
time. This is a limit on the references-only result: the hand and schema references are what a careful
engineer writes with the server and client side by side, which is the ceiling for those arms.

## Rules implied by other rules could not get isolated outside inputs
Decision: for a few single-field bounds implied by a cross rule (for example invoice total >= 0), the
generator's outside variants break the cross rule too; the HTTP tests still cover them. Reason: no
input can break only that bound. Stated per rule in task.json `desc`.

## Agreement for runs that did not complete
Decision: pre-registered in PREREGISTRATION.md (primary: runs that pass the gate; sensitivity: score 0).

## Whitespace and lengths
Decision: CONVENTIONS.md fixes "blank" as space, tab, CR, LF and length as Unicode code points, and the
generator uses only ASCII whitespace and a few emoji at length edges. Reason: otherwise the spec is
ambiguous and an arm's agreement would measure the spec's silence.
