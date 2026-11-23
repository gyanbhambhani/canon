# Experiment FS-1: pre-registration

Committed 2026-11-23, before any main-run call. The analysis script (`analysis/analyze.ts`), its
configuration (`analysis/config.json`), the runner, the harness, the starters and every task are
pinned by `MANIFEST.sha256`, committed with this file; the commit that adds this file is the
pre-registration.

**Owner approval comes after the fact.** The owner asked for every phase to run overnight without
stopping for approval (docs/canonbench.md, "Owner's run instructions", which also govern FS-1). This
file is committed before the main run, which is what makes it a pre-registration; the owner reviews
and approves it afterwards, and that review is recorded here when it happens.

## Question

Do agents ship more working full-stack features, with fewer frontend–backend mismatches, when they
write Canon than when they write Python and TypeScript directly? (docs/v0.5-fullstack.md,
"Experiment FS-1".)

## Design

- **Arms:** A direct (hand-written FastAPI and TypeScript client); B direct + OpenAPI (client
  generated from FastAPI's schema); C Canon (`canon build` generates both sides). Starters in
  `starters/`; arm checks in `harness/arms.ts`.
- **Tasks:** all 60 tasks in `tasks/` (39 feature, 21 change), each verified in all three arms on the
  pinned compiler. Ten carry `"adapted"` (their spec was narrowed so a Canon reference could exist):
  add-required-shipping-address, add-required-phone, add-required-category, bulk-restock,
  default-address, name-to-first-last, max-quantity-validation, stock-optional, user-addresses,
  tighten-password-rule.
- **Scaffold:** `runner/run.ts`: one prompt template and one text protocol for every arm and model;
  at most 5 edit-and-check rounds and 16 replies; automatic fixes applied in every arm before its
  checks; hidden tests never shown. The Canon arm's prompt also carries the core reference and the
  full-stack addendum (3,794 tokens by the repository's estimate), counted in its cost.
- **Hidden tests:** each task's HTTP tests, client tests (through the feature modules, against a
  live server) and boundary probes, plus the full regression suite (`harness/hidden.ts`).

## Models, settings and prices

| Model | Settings | List price (USD per million tokens) |
| --- | --- | --- |
| claude-opus-5-5 | effort medium (its default), no temperature (rejected by the model), server-side refusal fallback, max 16,000 tokens | input 4, output 20, cache read 0.20, cache write 5 (Claude API reference, 2026-11) |
| gpt-6.2-sol | reasoning effort medium, max 16,000 completion tokens, temperature not settable | input 2, output 10, cached input 0.10 (looked up 2026-11-22, research/canonbench/runner/models.ts) |
| Qwen2.5-Coder-7B-Instruct-8bit | local MLX (mlx_lm.server), temperature 0.2, max 6,000 tokens | 0 |

Tools: Node 25.8.0, Python 3.13.12, mypy 2.4.1, ruff 0.17.6, TypeScript 5.9.3, eslint 9.39.5,
FastAPI 0.165.0, Pydantic 2.14.4, openapi-typescript 7.13.0, openapi-fetch 0.17.0, pytest 8.4.2,
Canon 0.5.0 at compiler commit `630a193efae4130ca037f1e05005b89494c5b8b5` (no change to packages/
between that commit and this pre-registration).

## Pilot (done before this file; results/pilot-*.jsonl)

10 tasks chosen with seed 2026 (`analysis/pilot-select.ts`, first draw): paginate-orders,
product-count-by-tag, related-products, low-stock-report, order-notes, default-address,
search-products, status-to-string (feature), split-pay, tighten-password-rule (change); adapted:
default-address, tighten-password-rule.

- gpt-6.2-sol: 30/30 runs passed (100% in every arm).
- claude-opus-5-5: 24/24 completed runs passed (100% in every arm). Six runs were not made: the
  Anthropic account ran out of credit during the pilot (see "If Opus is unavailable").
- Qwen 7B: 0% in every arm so far (the pilot was still running when this file was committed; its
  final numbers go in the report).

**Difficulty check: failed for both frontier models.** Every arm sits at 100% end-to-end pass, so the
primary metric is at its ceiling for them. Replacing tasks overnight is not possible, so the main
run proceeds with the plan's primary analysis unchanged and adds one pre-registered secondary
measure that the pilot shows can still separate the arms: **first-round pass**, the hidden suite's
verdict on the project's state after the agent's first edit round (recorded by the runner as
`firstRound`). It is secondary and cannot change the win rule.

## Power analysis (analysis/power.ts on the pilot)

- With the pilot at the ceiling, the paired differences in end-to-end pass have zero variance, so
  the margin takes its pre-set floor: **non-inferiority margin m = 10 percentage points**.
- **Runs per task** (the largest R ≤ 3 whose projected cost stays within 90% of the cap): gpt-6.2-sol
  **3** (projected $20.77), claude-opus-5-5 **2** (projected $64.19, if it runs).
- Smallest detectable effects (80% power, two-sided 95%; 2.8 × SE over 60 tasks, or 21 for change
  tasks): end-to-end pass, change-task success, mismatch and false acceptance: not estimable from
  the pilot (no variance at the ceiling); first-round pass: 15.2 pp (GPT), 23.2 pp (Opus);
  validation agreement: 10.8 pp (GPT), 10.1 pp (Opus).
- **Qwen 7B** is exploratory if its pilot pass rate is under 10% in every arm (the plan's rule). It
  then runs **1 run per task**, last or at low priority, and never blocks the frontier runs.

## Analysis (analysis/analyze.ts, run as committed)

- **Unit:** the task. Runs are averaged per (task, arm, model); arms are compared on paired per-task
  differences, Canon minus the baseline; 95% percentile intervals from 10,000 bootstrap resamples
  of tasks, seed 2026.
- **Baseline:** the better of A and B on the pilot's end-to-end pass rate per frontier model; a tie
  goes to B (openapi). Both frontier models tied at 100%, so **the baseline is openapi for both**.
- **Primary comparison:** Canon against openapi on end-to-end pass rate, per frontier model.
- **Outcomes**, for the difference's interval [lo, hi] and m = 10 pp: **win** if lo > 0;
  **non-inferior** if lo > −m (and not a win); **lose** if hi < −m; **inconclusive** otherwise.
- **Secondary:** mismatch rate, change-task success, validation agreement (1,000 seeded inputs per
  validation spec), false acceptance (runs the arm's checks approved that fail hidden tests ÷ runs
  the checks approved), first-round pass, tokens, edit rounds, wall time and dollars per run, each per
  arm with intervals and as Canon − baseline.
- **Sensitivity:** every analysis is reported on all 60 tasks and again without the 10 adapted tasks.
- **Exploratory:** Qwen 7B (if it meets the exploratory rule), arm A versus Canon, and any metric not
  named above.

## Predictions (docs/v0.5-fullstack.md, word for word)

- feature tasks: Canon roughly ties both baselines;
- change tasks and mismatch rate: Canon beats A clearly, and beats B by less;
- validation agreement: Canon beats both, because only Canon writes validation once;
- cost: Canon uses more tokens, because of the reference.

## Win rule

"Canon is the better full-stack language for agents" is claimed only if, **for both frontier
models**, Canon is non-inferior to the chosen baseline on end-to-end pass rate, **and** significantly
better on change-task success (interval of the difference above 0) or mismatch rate (interval below
0).

## Rerun rule

Rerun infrastructure failures only: a model API error (other than a refusal), a crash or a timeout
of the harness. Never rerun a wrong answer. A run that fails because the provider account has no
credit is not recorded at all (the runner records nothing and stops that model), so it resumes
cleanly later. The analysis replaces a recorded infrastructure failure with its rerun, never the
reverse.

## Budget and the reduction rule

- **Hard cap: USD 100 per API model for FS-1** (separate from CanonBench's caps), enforced by the
  runner (`--cap 100`) from recorded dollars across the pilot and main-run files.
- **Reduction rule:** after the first 20 main-run runs of a model, project its total from their mean
  cost; if the projection exceeds 90% of the cap, reduce runs per task (3 → 2 → 1) until it fits, and
  record the reduction in DECISIONS.md and the report. Whatever happens, the runner stops launching
  runs at the cap.
- Main-run order: replicate by replicate (all 60 tasks × 3 arms for run 1, then run 2, ...), so a
  stop leaves complete replicates.

## If Opus is unavailable

The Anthropic account ran out of credit during the pilot (2026-11-23, 09:18 UTC); only the owner can
add credit. The runner probes claude-opus-5-5 with one cheap call about every 15 minutes and, if
credit returns, runs Opus under this pre-registration and its caps (finishing its pilot first). If
Opus stays unavailable:
- its cells are reported as **not run**;
- **the win rule cannot be evaluated** (it needs both frontier models), and the report says so;
- gpt-6.2-sol's result is reported as **the one frontier result available**, under the same outcome
  rules.

## Hashes (SHA-256; every pinned file is in MANIFEST.sha256)

- analysis/analyze.ts: `cb70cf6500a3256e7d70e0537fd11c75d95b0f45191ecebc6d2da4d44d258eff`
- analysis/config.json: `63e1502e75e550b412ce8472a120fa097861662c8cfa2d19125cbf53ea9de21c`
- analysis/power.ts: `1b2facae0821f2c710c0496e7f75a3be9a11027192cf500abc05dbea3daa32c8`
- runner/run.ts: `dc2e19c66a450a5d4dc59a27f14d1d9bd55a49cc6186690ea087c97541d5bb3e`
- runner/models.ts: `41949426eb5126f26ab6afc3ea1e79582075b434abea90b10e6a4c0161ef1c13`
- harness/hidden.ts: `70fc7d4121dfb93210628cabf5859767f0c9531d3f04cbea47b65d3077517a09`
- MANIFEST.sha256 (865 files): `37e7c7616046385c81807378a42abca0597b31fa3857312ded0710ddfb1ce189`

## Amendment 1 (2026-11-23, committed before any Qwen2.5-Coder-32B call)

The owner, awake, decided the following; GPT's main run was already under way, unchanged.

1. **claude-opus-5-5 is off for the rest of the run.** The Anthropic account will not be refilled
   tonight, so the probe stopped. Its 24 recorded pilot runs stay as recorded. Under "If Opus is
   unavailable", its main-run cells are reported as **not run**, the win rule (which needs both
   frontier models) **cannot be decided**, and gpt-6.2-sol's result is **the one frontier result**.
2. **Qwen2.5-Coder-7B** runs on CanonBench's MLX server (port 8091), the same model and weights as in
   the pilot, instead of a server of its own: two servers crashed one under memory pressure.
   Unchanged otherwise (exploratory, 1 run per task).
3. **Qwen2.5-Coder-32B-Instruct-4bit is added as an exploratory model**, not part of the win rule:
   20 tasks × 3 arms × 1 run, on CanonBench's server (port 8092), temperature 0.2, max 6,000 tokens,
   same scaffold and hidden tests. The 20 tasks are a fixed random subset (`analysis/subset-32b.ts`,
   seed 2032): search-products, add-required-category, products-in-price-range,
   change-display-name, delete-account, bulk-restock, add-line-to-order, cancel-order, order-detail,
   top-rated-products, average-rating, discontinue-product, paginate-orders, min-price-validation,
   tighten-password-rule, order-count-badge, rename-name-to-full-name, deactivate-user,
   stock-on-pay, discount-codes (16 feature, 4 change; 3 adapted). It is analyzed with
   analysis/analyze.ts like the other models; its intervals are over its 20 tasks.
4. **The reduction rule was applied to gpt-6.2-sol** after its first 20 main-run runs: mean $0.0404 per
   run, projected $21.83 for 540 runs plus $1.15 for the pilot = $22.99, under 90% of the $100 cap.
   **No reduction**: 3 runs per task, as pre-registered.

## Amendment 2 (2026-11-23): Qwen2.5-Coder-32B was not run

Amendment 1 added Qwen2.5-Coder-32B-Instruct-4bit as an exploratory model. **It was not run and is
dropped**: its three weight downloads failed, so no server could load it. Nothing about it enters
any analysis.

- The only local model is **Qwen2.5-Coder-7B-Instruct-8bit** on CanonBench's server (port 8091),
  exploratory, 1 run per task, as in Amendment 1 point 2.
- The 60 records that an early attempt wrote against a server that was not generating (every one
  "generation thread died") are infrastructure failures, not results. They are kept unscored in
  `results/dropped-qwen32-infrastructure-failures.jsonl`, outside the `results/main-*.jsonl` files
  the analysis reads.
- `analysis/subset-32b.ts` stays in the repository, unused.
- Everything else in Amendment 1 stands: Opus off and its cells reported as not run, the win rule
  undecidable, and gpt-6.2-sol the one frontier result.

## Amendment 3 (2026-11-23): GPT stopped part-way because the OpenAI account ran out of credit

The OpenAI account ran out of credit during the main run (HTTP 429 "You have no credits remaining").
The Anthropic account had already run out during the pilot (Amendment 1). Neither API was probed
again. Every call that failed for lack of credit is an infrastructure failure: it is never scored as
a wrong answer, and it is not counted among the runs.

**What exists for gpt-6.2-sol.** 349 records were written; 161 are real runs and 188 are
infrastructure failures (183 "no credits remaining", 3 timeouts, 1 connection error, 1 terminated
process). The 188 are moved, unedited, to `results/dropped-gpt-infrastructure-failures.jsonl`
(outside the `results/main-*.jsonl` files the analysis reads). The 161 real runs are in
`results/main-gpt.jsonl` (96, replicate 1) and `results/main-gpt-r3.jsonl` (65, replicate 3);
replicate 2 never produced a real run, because its process was queued behind replicate 1. Both
replicates visited the tasks alphabetically, so the covered tasks are an alphabetical prefix, not a
random sample.

| GPT real runs per arm | Tasks |
| --- | --- |
| 2 each in direct, openapi and canon (replicates 1 and 3) | 20 |
| 1 each | 9 |
| unequal across arms | 4: get-profile (1/2/2 direct/openapi/canon), max-quantity-validation (2/1/1), min-price-validation (2/1/1), product-price-label (1/0/0) |
| none | 27 |

No task reached the pre-registered 3 runs. Of the 540 planned GPT runs, 379 are missing.

**Partial analysis.** The pre-registered analysis (`analysis/analyze.ts`, unchanged) is re-run only on
what exists, labelled **partial**, restricted to the 29 tasks where all three arms have the same
number of GPT runs (`analysis/partial.ts` writes `results/partial-gpt.jsonl`; 147 runs; 23 feature,
6 change, 6 adapted). It uses `analysis/config-partial.json` (frontier = gpt-6.2-sol only). The
analysis' "win rule" line is **not** reported: the win rule needs both frontier models, so it
cannot be evaluated. The report gives the measured effects with their 95% intervals and no verdict.

**Opus stays absent.** claude-opus-5-5's main-run cells are "not run"; only its 24 pilot runs exist.

**One change to a pinned file.** `runner/run.ts` now also treats OpenAI's "no credits remaining" and
`insufficient_quota` as a credit failure (recorded as nothing, the model stops), as it already did
for Anthropic's. It changes no scoring. Its SHA-256 is now
`7bf4c6d6218cabd778c02b9468ba18d3f03a329a51683bd310e8feb310f85038`; every other file in
`MANIFEST.sha256` still matches.

**To complete the run.** Add credit to both accounts and re-run the same commands (failed calls were
not recorded, so recorded runs are skipped); see REPORT.md.
