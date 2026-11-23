# Benchmark pre-registration

Written and committed **before** the full benchmark ran (see this file's git history). The
report (`src/report.ts`) applies these rules mechanically; nothing here changes after the data
exists. If a rule turns out to be wrong, the fix is a new, separately dated pre-registration and
a new run, never an edit to this one.

## The claim under test

> Canon is a language for AI agents, the way Markdown skill files are for instructions: agents
> understand it from its reference alone, code it correctly, write it one way, and get to working
> code at least as fast as in a language they already know.

## Setup (fixed)

- **Models:** `claude-opus-5-5` (effort `medium`) and `gpt-6.2-sol`, both at provider defaults otherwise.
- **Languages:** Canon v0 (the full `/llms.txt` reference is the system prompt) and TypeScript
  (strict mode). The task prompts are the same apart from the language-specific signature.
- **Tasks:** the 50 in `src/tasks.ts`, 40 basic and 10 hard. Every expected value is validated
  against independent reference solutions (`src/validate-tasks.ts`).
- **Runs:** 10 per (model, language, task), so 2,000 runs in total.
- **Loop:** draft, then checker feedback (Canon: `canon check` JSON with patches; TypeScript: `tsc
  --strict` errors), then at most 3 fix rounds, then the hidden tests.
- **Exclusions:** runs a refusal-fallback model served (Claude only) are excluded. Runs that
  failed with an API error are retried until recorded; they are never counted as failures.

## Metrics (per model, per language)

| Metric | Definition |
| --- | --- |
| Correct | Share of runs whose final program passes the checker **and** every hidden test. |
| First-pass valid | Share of runs whose first draft passes the checker unchanged. |
| Distinct programs | For each task, the number of different normalized final programs across its 10 runs (Canon: `canon fmt`; TypeScript: Prettier), averaged over tasks. |
| Turns to correct | Model turns used (1 + fix rounds), averaged over correct runs. |
| Tokens per correct program | Total input + output tokens of all runs, divided by the number of correct runs. Reported, not judged. |

## Decision rules

A criterion is **supported** only if it holds for **both** models. Bootstrap intervals resample
tasks with replacement, 10,000 times, with seed 2026, so the report is exactly reproducible from
the raw runs.

| # | Part of the claim | Supported when |
| --- | --- | --- |
| C1 | Understood from the reference alone | Canon's Correct rate is at least TypeScript's minus 5 percentage points (non-inferiority). |
| C2 | Coded right | Canon's Correct rate is at least 90% over all tasks **and** at least 80% on the hard tier. |
| C3 | One way to write it (the core bet) | Canon's mean Distinct programs is at most half of TypeScript's, **and** the upper end of the 95% bootstrap interval of the ratio (Canon / TypeScript) is below 1. |
| C4 | At least as fast for an agent to code in | Canon's mean Turns to correct is at most TypeScript's plus 0.25. |
| C5 | Programs run faster | **Not tested.** Canon v0 compiles to JavaScript, so it runs at TypeScript's speed by construction. A native backend is future work; no runtime-speed claim may be made from this benchmark. |

## What may be said afterwards

- If C1 to C4 are all supported: "On this benchmark, with Claude Opus 5.5 and GPT-6.2 Sol, agents
  coded Canon from its reference alone as correctly and as quickly as TypeScript, and wrote far
  fewer distinct programs per task." The statement must keep its scope: two models, 50 tasks.
- If any is not supported, the report states which ones, with their numbers, and the claim is
  narrowed to the supported parts.
- C5 is never claimed from this benchmark.
