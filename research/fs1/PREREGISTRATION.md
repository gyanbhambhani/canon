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
