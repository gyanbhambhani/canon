# Benchmark pre-registration: Canon v0.2

Written and committed **before** the v0.2 run (see this file's git history). It is a new,
separately dated pre-registration; [PREREGISTRATION.md](PREREGISTRATION.md) (v0) is unchanged.
`src/report-v02.ts` applies these rules mechanically to `results/runs-v0.2.jsonl`.

## What changed since v0, and why

Canon v0.2 changes four constructs, each traced to v0's M8 data (DECISIONS.md, "Language v0.2"):
`x = e` replaces `set x = e`; `while cond` replaces `for cond`; `+` joins strings and `concat` is gone;
`match` may appear in any expression position. The agent reference (`/llms.txt`, the For agents page)
was also trimmed, because it is the main cost of a Canon run.

**The hypothesis:** convergence comes from making the form models reach for available and banning
the alternatives. Restricting a construct without leaving the natural form makes models improvise,
and improvisations vary.

## Setup (fixed; the same as v0 unless stated)

- **Models:** `claude-opus-5-5` (effort `medium`, prompt caching on, refusal fallbacks on) and `gpt-6.2-sol`.
- **Languages:** Canon v0.2, whose system prompt is the For agents page as committed with this file, and
  TypeScript (strict). TypeScript is **re-run** in the same session, so model drift since v0 affects both arms equally.
- **Tasks, runs and loop:** the same 50 tasks (`src/tasks.ts`, unchanged), 10 runs per (model, language,
  task), 2,000 runs in all, and the same loop (draft, then checker feedback, at most 3 fix rounds, then
  hidden tests). Prompts are unchanged apart from the reference text.
- **Exclusions:** the same as v0 (fallback-served runs are excluded; API failures are retried, never counted).

## Metrics

All of v0's metrics (Correct, First-pass valid, Distinct programs, Turns to correct, Tokens per correct
program), plus:

| Metric | Definition |
| --- | --- |
| Structural distinct | Like Distinct programs, but programs are first passed through `src/structure.ts`: comments removed, Canon `requires:`/`ensures:` lines removed, and every identifier the program introduces (not fixed by the task, not a keyword or built-in, not a member name after `.`) renamed `_1`, `_2`, ... in order of first appearance. **Disclosure:** this metric was designed after reading v0's programs (where variants often differed only in a helper's name or an optional contract). That is why it is secondary and the raw count stays primary. |
| Dollars per correct program | Claude only (OpenAI's price for this model is not available to the harness): total Claude cost of the runs, divided by the number of correct runs, with prompt caching on as in real use. |

Every rate and mean is reported with a 95% bootstrap interval (tasks resampled with replacement,
10,000 times, seed 2026), and the chart shows those intervals.

## Decision rules

Each criterion is **supported** only if it holds for **both** models (C6: Claude only).

**v0.2 against TypeScript (the same rules as v0, so the two runs compare):**

| # | Part of the claim | Supported when |
| --- | --- | --- |
| C1 | Understood from the reference alone | Canon's Correct rate is at least TypeScript's minus 5 percentage points. |
| C2 | Coded right | Canon's Correct rate is at least 90% overall and at least 80% on the hard tier. |
| C3 | One way to write it (primary) | Canon's mean Distinct programs is at most half of TypeScript's, and the upper end of the 95% interval of the ratio is below 1. |
| C3s | One way to write it, structurally (secondary) | The same rule as C3, applied to Structural distinct. |
| C4 | At least as fast for an agent | Canon's mean Turns to correct is at most TypeScript's plus 0.25. |
| C5 | Programs run faster | **Not tested** (Canon compiles to JavaScript). |
| C6 | Affordable | Canon's Dollars per correct program (Claude) is at most 1.5 times TypeScript's. |

**v0.2 against v0 (Canon only, paired by task, against the v0 runs in `results/runs.jsonl`):**

| # | Question | Supported when |
| --- | --- | --- |
| D1 | Did v0.2 improve convergence? | The ratio of mean Distinct programs (v0.2 / v0) is below 1, with the upper end of its 95% interval below 1. |
| D1s | ... structurally? | The same, on Structural distinct. |

D1 compares against runs made earlier the same day, without re-running v0, so model drift is a
stated limitation of D1 (not of C1 to C6).

## What may be said afterwards

The report lists every criterion with its numbers and intervals. Statements are limited to the
supported criteria, scoped to these two models and 50 tasks. If C3 is still not supported, the
claim "Canon makes agent output converge" is not made. Interval-overlapping differences are
described as "no difference detected", never as better or worse.
