# VA-1 pre-registration

Committed 2026-11-23 before any model call. Spec: docs/experiment-va1.md. Files pinned by hash in
MANIFEST.sha256 (starters, tasks with their hidden tests and references, the generator, the harness,
the runner and its prompts, the analysis script, tool pins in package.json and requirements.txt).
Tools: FastAPI 0.165.0, Pydantic 2.14.4, ruff 0.17.6, mypy 2.4.1, pytest 8.4.2, openapi-typescript 7.13.0
(types), ajv 8.17.1 (validators), TypeScript ~5.9.3, the repository's canon CLI (v0.5.0 full-stack build).

## What is already known when this is written (disclosure)
Phase 1 (references only, no model) was run first, because it is free and a precondition for the tasks:
all 40 tasks verify in all 3 arms (120 of 120 references pass their hidden tests and checks), and
validation agreement is 1.000 in every arm on both sets (results/references.jsonl). Phase 1's
predictions in the spec ("S and C near 100%, H lower; Set 2: C at 100%, S and H lower") are therefore
contradicted by the data, and this is reported as the result (see REPORT.md). The Phase 2 predictions
below are fixed without reference to any Phase 2 data.

## Amendment 1: what is not run (before the first Qwen call)
- GPT-6.2 Sol is NOT run: the OpenAI account is out of credit (a GPT call would be an infrastructure
  failure and record nothing). The USD 20 cap is therefore unused: the experiment spent USD 0. To run it
  the owner would refill the OpenAI account (about USD 20) and run `runner/run.ts` with a GPT model, which
  this runner does not implement because the pre-registered scope excludes it.
- Claude Opus 5.5 is not run (the Anthropic account is out of credit; the spec says it is optional).
- Qwen2.5-Coder-32B is not run (its weights failed to download; port 8092 is not used).
- Phase 2 is Qwen2.5-Coder-7B-Instruct-8bit only, on CanonBench's server at port 8091 (never started by
  VA-1), 3 runs per task per arm, temperature 0.2, up to 5 edit rounds and 16 replies. Runs are ordered
  run 1 for all (task, arm), then run 2, then run 3; if time runs out, the incomplete later runs are
  reported as not run, and the analysis uses whatever runs were recorded.
- Because only one small model runs, every Phase 2 comparison is exploratory. The references carry the
  main claim.

## Predictions (stated exactly as in the spec)
> Predictions, committed before the run: Set 1: Canon ties S (non-inferior, not a win); Canon beats H.
> Set 2: Canon beats S and H by a large margin. If Canon does not beat S on Set 2, say so: it would mean
> the stronger baseline closes the gap and the headline weakens to "Canon beats hand-written code".

## Measures and analysis (fixed)
- Unit: the task; paired across arms; 95% bootstrap intervals over tasks, seed 2026, 10,000 resamples.
- Primary comparison: validation agreement, Canon minus Schema-driven, Set 2, per model (for Phase 2:
  Qwen 7B, exploratory). Everything else is exploratory.
- Outcomes: win (interval above 0), non-inferior (lower end above -0.03), lose (interval below 0),
  inconclusive (otherwise).
- Validation agreement: on 1,000 seeded inputs per task (seed 2026, the same for every arm; harness/
  generator.ts: 10% valid, 20% on the inside edge of a rule, 50% just outside a rule, 20% random), the
  share where the client says invalid (rejects before sending) exactly when the server answers 422.
  Counted separately: client-says-valid and server-says-invalid (bounce), and client-says-invalid and
  server-says-valid (block).
- Gate: a run is completed when every hidden HTTP test and the client wiring check pass. For agent runs
  the primary agreement is the mean over a task's completed runs, and a task enters a paired comparison
  only if both arms have at least one completed run (the count is reported). Sensitivity: agreement of a
  run that did not complete counts as 0.
- Reported with and without adapted tasks (tasks narrowed so Canon could express them: gift-card,
  signup-password, invoice, range-filter).
- Rerun only infrastructure failures (the model server failing); a wrong answer is never rerun.
- Scope limits (not results): no task uses a pattern, a per-element list rule or a rule inside an
  Option, because Canon's portable `requires` cannot express them.
- The analysis script is analysis/analyze.ts; REPORT.md quotes only its output.
