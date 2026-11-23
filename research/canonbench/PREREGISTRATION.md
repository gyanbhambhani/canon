# CanonBench pre-registration

Committed before any main-run model call, on branch `worktree-agent-a5ea7b856ce17a840`. The plan is
docs/canonbench.md; every deviation from it is listed in DECISIONS.md (numbers refer to its entries).
The owner's approval of this document comes after the fact (owner's run instructions, 2026-11-22).

## 1. What is compared

Canon (v0.5 brace syntax, compiler at main c2cb47e merged into this branch) against Python and
TypeScript, each with its standard toolchain (arms/check.ts, arms/props.ts):

| Arm | Automatic fixes (never cost a round) | Checker feedback (JSON, with patches) | Property testing | Tests run by |
| --- | --- | --- | --- | --- |
| canon | `canon check --fix` (C001, E101, E102, T009) | `canon check --json` | `canon test` contract fuzzing (100 inputs) | Canon JS runtime, sandboxed |
| py | `ruff check --fix` (E, F, W, B, UP, SIM, RUF; safe fixes) | `mypy --strict`, "did you mean" rename patches, ruff fixes as patches | Hypothesis (100 examples) on functions that `assert` | CPython, sandboxed |
| ts | `eslint --fix` (typescript-eslint recommended) | `tsc --strict`, language-service quick fixes as patches | random typed inputs (100) when the module asserts | Node vm, sandboxed |

Feedback budget: a draft plus up to 3 feedback rounds (WRITE, FIX, CHANGE). Hidden tests are never
shown. Canon prompts carry the core agent reference (apps/web/content/docs/for-agents.mdx); its
tokens count toward Canon's cost. One prompt template per family for every arm (arms/prompts.ts).

## 2. Models (locked)

| Key | Model | Settings |
| --- | --- | --- |
| qwen7b | mlx-community/Qwen2.5-Coder-7B-Instruct-8bit (snapshot b292f3cb), mlx_lm 0.32.2 / mlx 0.32.4 | temperature 0.2, top_p 1.0, max 2,048 output tokens (READ 1,024) |
| opus | claude-opus-5-5 | adaptive thinking, effort "medium", max 16,000 tokens; temperature not settable |
| gpt | gpt-6.2-sol | reasoning_effort "medium", max 16,000 completion tokens; temperature not settable |

Tool versions: Python 3.13.12, mypy 2.4.1, ruff 0.17.6, Hypothesis 6.170.17, pydantic 2.14.4,
FastAPI 0.165.0; Node 25.8.0, TypeScript 5.9.3, ESLint 9.39.5, typescript-eslint 8.73.0;
Canon 0.5.0 at main c2cb47e.

## 3. Items (hashes in MANIFEST.sha256)

| Family | Items per language / arm | Seeds (unit of analysis) | Verification |
| --- | --- | --- | --- |
| READ | 198 questions x 4 arms (canon, canon-stripped, py, ts): output 60, failure 22, property 52, effects 64 | 76 (60 + 16 effectful) | answers executed on all three references (agreeing), property "no" answers fuzz-backed (10,000 inputs) and reviewed; effects confirmed by the instrumented sandbox and Canon's checker |
| WRITE | 60 | 60 | three references pass every hidden test (537) and agree on 1,000 in-spec fuzzed inputs |
| FIX | 101 (two matched mutants per seed where available) | 53 | every mutant passes its checker and fails at least one hidden test |
| CHANGE | 24 | 24 | updated references pass new and regression tests; originals fail a new test |
| THINK -> Python | 60 (derived from WRITE runs, DECISIONS 19) | 60 | Canon references pass every hidden test after compiling to Python |
| THINK -> TypeScript | not run (DECISIONS 18) | | |
| FULL-STACK | FS-1, by its own pre-registration (research/fs1 on main) | | |

## 4. Runs

- **Runs per item: 3** for every family and every model.
- **Order:** API models run all families, all three runs, concurrently (8 requests at a time).
  Qwen runs run-major: run 0 of READ, WRITE, FIX, CHANGE, then run 1, then run 2, so that if the
  night ends first, every item has the same number of completed runs except within one run.
  **Stop rule for Qwen:** whatever has completed at 07:00 PST is analysed; a partial run is included
  (seed scores average over the runs each seed has).
- **Rerun rule:** infrastructure failures (API errors, crashes, timeouts of the harness) are not
  recorded and are retried by re-running the runner; wrong answers are recorded and never rerun.

## 5. Dollar caps and the cost check

- **Hard caps: USD 150 per API model, USD 300 in total** (CanonBench and FS-1 together; the runner
  stops a model when its ledger reaches its cap, however far it got).
- **Cost check (pilot, >= 24 items per family per API model):**

| Model | Family | Pilot runs | Pilot USD/run | Planned runs | Projected USD |
| --- | --- | --- | --- | --- | --- |
| opus | read | 160 | 0.0095 | 2376 | 22.60 |
| opus | write | 30 | 0.0275 | 540 | 14.84 |
| opus | fix | 42 | 0.0189 | 909 | 17.22 |
| opus | change | 24 | 0.0217 | 216 | 4.68 |
| opus | **total** | | | | **59.33** (cap 150) |
| gpt | read | 160 | 0.0012 | 2376 | 2.84 |
| gpt | write | 30 | 0.0065 | 540 | 3.53 |
| gpt | fix | 42 | 0.0063 | 909 | 5.71 |
| gpt | change | 24 | 0.0061 | 216 | 1.31 |
| gpt | **total** | | | | **13.39** (cap 150) |

- **Reduction rule** (if a projection exceeds a cap): drop to 2 runs, then 1 run, then a random
  subset of seeds (fixed seed 7), in that order, until the projection is below 80% of the cap.

## 6. Analysis (analysis/analyze.ts, analysis/think.ts; hashes below)

- Unit: the seed; runs and items are averaged per seed; arms are paired by seed.
- Per cell (family x model): d = Canon - baseline; 95% percentile bootstrap over seeds (10,000
  resamples, seed 20261123); one-sided bootstrap p for "Canon better".
- Baselines (chosen from the pilot, before the main run; the better of Python and TypeScript, ties to
  Python; THINK's baseline is Python by construction): analysis/baselines.json, reproduced below.
- **Margin m = 10 percentage points** (from the power analysis below: the main run's minimum
  detectable effects for the Qwen cells are 10 to 20 points; frontier cells had no pilot variance).
- Outcomes: **win** = Holm-adjusted p < 0.025 across the primary cells (READ, WRITE, FIX, CHANGE,
  THINK x 3 models) and the interval above 0; **non-inferior** = interval's lower end above -m;
  **lose** = whole interval below -m; **inconclusive** otherwise. The READ sub-rows (effects,
  property, output) are a second Holm family.
- Cost: tokens per item (all rounds, input + output), Canon / baseline, bootstrap on per-seed log
  ratios.
- Secondary: per-question-type READ accuracy; the annotation ablation (Canon vs stripped Canon;
  stripped Canon vs baseline); first-try check pass; self-healing rate; false acceptance; rounds and
  tokens per pass; CHANGE regression rate; THINK compiled-vs-JS failures; readability preference
  (analysis/judge.ts: up to 100 blind pairs, cross-model judges).
- The win rule (plan 7.3) is applied to the frontier models only, as written.

### Baselines and power analysis (pilot: 10 seeds + 4 effectful seeds, 1 run)

| Cell | Pilot seeds | Canon | Python | TypeScript | Baseline | SD of paired difference | MDE at main-run n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| READ qwen7b | 14 | 52.4 | 46.4 | 48.8 | ts | 0.246 | 7.9 pts |
| READ opus | 14 | 95.2 | 95.2 | 95.2 | py | 0.000 | not estimable (no pilot variance) |
| READ gpt | 14 | 95.2 | 89.3 | 95.2 | ts | 0.000 | not estimable (no pilot variance) |
| READ-effects qwen7b | 4 | 37.5 | 50.0 | 50.0 | py | 0.144 | 10.1 pts |
| READ-effects opus | 4 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| READ-effects gpt | 4 | 100.0 | 87.5 | 100.0 | ts | 0.000 | not estimable (no pilot variance) |
| READ-property qwen7b | 9 | 88.9 | 77.8 | 88.9 | ts | 0.000 | not estimable (no pilot variance) |
| READ-property opus | 9 | 77.8 | 77.8 | 77.8 | py | 0.000 | not estimable (no pilot variance) |
| READ-property gpt | 9 | 77.8 | 66.7 | 77.8 | ts | 0.000 | not estimable (no pilot variance) |
| READ-output qwen7b | 10 | 40.0 | 25.0 | 25.0 | py | 0.412 | 14.9 pts |
| READ-output opus | 10 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| READ-output gpt | 10 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| WRITE qwen7b | 10 | 0.0 | 20.0 | 30.0 | ts | 0.483 | 17.5 pts |
| WRITE opus | 10 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| WRITE gpt | 10 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| FIX qwen7b | 7 | 57.1 | 78.6 | 71.4 | py | 0.267 | 10.3 pts |
| FIX opus | 7 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| FIX gpt | 7 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| CHANGE qwen7b | 8 | 25.0 | 62.5 | 75.0 | ts | 0.535 | 30.6 pts |
| CHANGE opus | 8 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| CHANGE gpt | 8 | 100.0 | 100.0 | 100.0 | py | 0.000 | not estimable (no pilot variance) |
| THINK qwen7b | 10 | 0.0 | 20.0 | – | py | 0.422 | 15.2 pts |
| THINK opus | 10 | 100.0 | 100.0 | – | py | 0.000 | not estimable (no pilot variance) |
| THINK gpt | 10 | 100.0 | 100.0 | – | py | 0.000 | not estimable (no pilot variance) |

analysis/baselines.json:

```json
{
 "READ|qwen7b": "ts",
 "READ|opus": "py",
 "READ|gpt": "ts",
 "READ-effects|qwen7b": "py",
 "READ-effects|opus": "py",
 "READ-effects|gpt": "ts",
 "READ-property|qwen7b": "ts",
 "READ-property|opus": "py",
 "READ-property|gpt": "ts",
 "READ-output|qwen7b": "py",
 "READ-output|opus": "py",
 "READ-output|gpt": "py",
 "WRITE|qwen7b": "ts",
 "WRITE|opus": "py",
 "WRITE|gpt": "py",
 "FIX|qwen7b": "py",
 "FIX|opus": "py",
 "FIX|gpt": "py",
 "CHANGE|qwen7b": "ts",
 "CHANGE|opus": "py",
 "CHANGE|gpt": "py",
 "THINK|qwen7b": "py",
 "THINK|opus": "py",
 "THINK|gpt": "py"
}
```

## 7. Predictions (plan section 7.2, committed as written)

| Family | Qwen 7B | Frontier models |
| --- | --- | --- |
| READ, effects | win (large) | win (large) |
| READ, property | win | win |
| READ, output | non-inferior | non-inferior |
| WRITE | inconclusive or lose (unfamiliar language) | non-inferior |
| FIX | win | non-inferior |
| CHANGE | win | non-inferior |
| THINK, single programs | win | non-inferior |
| FULL-STACK | inconclusive | win on change tasks and mismatch |
| Cost | lose (more tokens) | lose (more tokens) |

## 8. Known limits, stated before the main run

- The pilot put both frontier models at 100% on WRITE, FIX and CHANGE for all three languages
  (pilot seeds). The plan says trivial items are replaced before the main run; there was no time to
  build harder items overnight, so they are kept (DECISIONS 29). Expect frontier cells in these
  families to be non-inferior with narrow intervals, or inconclusive; a frontier "win" there is
  unlikely by construction, so the plan's win rule is unlikely to be met even if Canon is better.
- READ's property "no" answers are fuzz-backed, not proven (DECISIONS 12).
- THINK's Canon arm reuses WRITE runs and never saw build errors as feedback (DECISIONS 19).

## 9. Hashes

Full list: MANIFEST.sha256 (every item, seed, test, reference, prompt template, arm, runner and analysis file).

```text
528 files; combined sha256 2329c18dae28f51820455fc5e1d19590bf85cab643296f3dc8cc82c9667342f4
caddbf0c95ba7402e4a5505b23de60dd9a7ed1078b9ab463d3a2db35b2359976  items/read.jsonl
376a060e86182274ff38e19a12de887cd4a0022153080501933a3f54162773b7  items/fix.jsonl
b2663b09106cbc847e1b240f2bab113ada12a36ddf592b708674f150ea4ba9e2  items/write.txt
8472a0b9e4cbfbe4dfd4eb9336450d5ab5cdc4083119e787137914fe7ee75d2c  items/change.txt
7c7a3d7f7b3baf6f236fc251b689f9f488762f21c288e905d4bd2a596cb7f45f  arms/prompts.ts
f5b255c50e73d07fa9050162e7e63848b8e7662fd816fa05a34761df74042a74  analysis/analyze.ts
fbc0151da29ec036c2eef8dab01acd2f686c542d6ddb4f7bd7cc2e82380c67b5  analysis/think.ts
```
