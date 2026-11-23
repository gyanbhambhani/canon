# CanonBench: does an agent read, understand, write and think better in Canon?

An evaluation plan for Canon v0.5. Save as `docs/canonbench.md` and build it under `research/canonbench/`. It reuses what exists: the 60 hard tasks and their 537 hidden tests from Experiment 1, the Experiment 1 runner, and Experiment FS-1 from `docs/v0.5-fullstack.md`.

---

## 1. The claim, and how this benchmark tests it

**The claim:** Canon is the best language for AI agents to work in. Agents understand it, write it, fix it and change it at least as well as Python and TypeScript, and better where Canon's design should matter. And when the code has to ship as Python or TypeScript, writing it in Canon first and compiling it gives better results than writing the target language directly.

**Five test families,** one per thing an agent does with code:

| Family | The agent... | Canon's predicted edge |
| --- | --- | --- |
| **READ** | answers questions about code it is shown | effects, types and contracts are written in the code, not inferred |
| **WRITE** | builds a program from a description | compiler feedback with patches |
| **FIX** | repairs a broken program | errors arrive with ready-made fixes |
| **CHANGE** | extends working code without breaking it | contracts and exact effects catch what a change breaks |
| **THINK** | must deliver Python or TypeScript, and may write Canon first and compile it | Canon's checks apply while thinking; the output stays mainstream |

**Plus three cross-cutting measures:**
- **Self-healing rate:** the share of an agent's errors the toolchain fixes without another model turn. This measures "the language compiles itself."
- **False acceptance:** the share of programs the language's own checks approve that still fail hidden tests. This measures whether you can trust the checker when it says OK.
- **Cost:** tokens, turns and wall time per success, with Canon's reference counted against Canon.

**The output is one scoreboard:** families across the top, models down the side. Each cell says win, non-inferior, inconclusive or lose for Canon against the best other language, with 95% intervals.

---

## 2. Models

| Model | Where it runs | Role |
| --- | --- | --- |
| Qwen2.5-Coder 7B | local | the small-model test, where errors are common and feedback should matter most |
| Claude Opus 5.5 | API | frontier |
| GPT-6.2 Sol | API | frontier |

- **Optional, if time allows:** Qwen2.5-Coder 1.5B and 14B, reported as exploratory, to show the trend with model size.
- **Locked in the pre-registration:** every model version, quantization and sampling setting. Primary runs use temperature 0.2, three runs per item.

---

## 3. Languages and toolchains

Each language gets **its best standard toolchain**, with the same feedback budget. This compares languages as they actually ship, which is the claim.

| Language | Checker feedback | Automatic fixes | Property testing | Test runner |
| --- | --- | --- | --- | --- |
| Python 3.11 | `mypy --strict`, as JSON with patches where mypy or ruff offer them | `ruff --fix` | Hypothesis on the model's own `assert`s and type hints | pytest |
| TypeScript 5 | `tsc --strict`, with quick-fix patches | `eslint --fix` | fast-check on the model's own assertions | vitest |
| Canon v0.5 | `canon check --json` with patches | `canon check --fix` | `canon test` contract fuzzing | `canon test` |

**Rules that hold in every family:**
- **Same feedback rounds:** up to 3 for WRITE, FIX and CHANGE; 5 for full-stack tasks.
- **Automatic fixes are applied the same way in every arm,** and either count as a round in every arm or in none.
- **Hidden tests are never shown,** in any arm.
- **One prompt template for every arm,** with the same output instruction: code only, plus at most three lines of rationale.
- **Canon prompts include the core reference** (and the full-stack addendum for full-stack tasks). Python and TypeScript prompts get no reference. The reference tokens count toward Canon's cost.
- **The Canon surface** is whichever one Experiment 1b picks: brace syntax or Canon-Py. If 1b hasn't reported yet, use brace syntax and record it.

---

## 4. Building the benchmark

The quality of the items decides whether anyone believes the result. Every item is verified before it can be used.

### 4.1 Seed problems: 120

| Source | Count | Why |
| --- | --- | --- |
| Experiment 1's hard tasks | 60 | already built, with 537 hidden tests |
| A standard benchmark (HumanEval+ and MBPP+, the harder problems) | 30 | comparability with published work; reported as its own subset, because Python has a training-data advantage on these |
| New effectful problems | 30 | programs that read files, call a mocked host, use the clock or randomness, or touch a table; READ's effect questions need them |

Full-stack items come from FS-1's shop app (see FULL-STACK in section 5).

### 4.2 Three idiomatic references per seed

For every seed, write a reference solution in Canon, Python and TypeScript.

- **Each must be idiomatic for its language,** written the way a careful engineer would: type hints and docstrings in Python, types and JSDoc in TypeScript, native features in Canon.
- **Never generate the Python or TypeScript reference from Canon.** That would make them read like Canon and bias READ toward it.
- **The three must be equivalent:** each passes every hidden test, and all three agree on 1,000 fuzzed inputs, run through per-language adapters. Seeds that fail this check are dropped.

### 4.3 Language-neutral tests

Hidden tests are stored as JSON (input, expected output, expected error kind) and run through three adapters: `adapters/python`, `adapters/typescript`, `adapters/canon`. One test suite then serves all three languages, so no language gets easier tests.

### 4.4 Execution sandbox

- **Every program runs with a time limit and a memory limit,** with no real network access.
- **Effects are observed, not trusted:** an instrumented sandbox records every file access, network call (to mocked hosts), clock read and random draw. That recording is the ground truth for READ's effect questions.

---

## 5. Item generation

### READ: about 1,440 items (120 seeds × about 4 questions × 3 languages)

The model is shown a program and answers one question. Answers are exact-match scored: a value, a set of names, or yes/no.

| Question type | Example | Ground truth |
| --- | --- | --- |
| **Output** | "What does `summarize([3, -1, 4])` return?" | execute the reference |
| **Effects** | "Which of these functions can access the network?" (effects are hidden one or two calls deep) | the instrumented sandbox, plus a static check |
| **Property** | "Can `discount` ever return a negative number?" | fuzzing (10,000 inputs) plus a solver where decidable; items whose answer isn't certain are dropped |
| **Failure** | "For which of these inputs does `parse_version` fail?" | execute the reference |

**One fairness control matters here.** Canon writes contracts and effects in the code, which is its design. A reviewer will ask whether Canon only wins because the answer is printed in the source. So also run a **"Canon, annotations stripped"** arm, with `requires`, `ensures` and `effects` removed. Canon versus stripped Canon isolates the value of the annotations; stripped Canon versus Python and TypeScript isolates the syntax.

### WRITE: 120 items per language

The model gets a natural-language spec, the function signature and two examples, then writes the program, with up to 3 feedback rounds.

### FIX: 240 items per language (2 bugs per seed)

- **Matched mutation types,** applied to each language's reference: off-by-one, wrong operator, a missing case, a wrong field, swapped arguments, a missing or undeclared side effect, a wrong error branch.
- **Every mutant must fail at least one hidden test.** Mutants that still pass are dropped.
- **The model gets** the broken program, one failing example (input, expected output, actual output) and the checker's output. Up to 3 rounds.

### CHANGE: 120 items per language

- **One new requirement per seed,** such as "also accept negative versions" or "return the top k instead of the top 1," with updated hidden tests.
- **Regression tests:** the original tests that still apply must keep passing.

### THINK: 120 items × 2 target languages

The model must deliver **Python** (or **TypeScript**). Two arms:

- **Direct:** write the target language with its toolchain.
- **Through Canon:** write Canon with its toolchain, then `canon build` compiles it to the target.

Both deliverables are run against the same hidden tests in the target language. This is the "think in Canon, ship mainstream" claim, tested on single programs.

Also measure **output readability**: a blind pairwise judge (a model that sees neither arm's label) compares Direct output with compiled output on 100 items: "which would you rather maintain?" Report the preference rate. Compiled code that loses badly here fails the vision even if it passes the tests.

### FULL-STACK: FS-1

Run Experiment FS-1 exactly as specified in `docs/v0.5-fullstack.md` (40 feature tasks and 20 change tasks; arms Direct, Direct + OpenAPI, and Canon), and fold its results into the scoreboard as the THINK family's full-stack row.

---

## 6. Metrics

| Family | Primary metric | Secondary metrics |
| --- | --- | --- |
| READ | accuracy | accuracy per question type; the annotations-stripped comparison |
| WRITE | pass rate (all hidden tests) after up to 3 rounds | first-try check pass; false acceptance; self-healing rate; tokens and rounds per pass |
| FIX | repair rate | rounds to repair; new failures introduced |
| CHANGE | pass rate on the updated tests | regression rate on the original tests |
| THINK | target-language pass rate | readability preference; tokens per pass |
| FULL-STACK | end-to-end pass rate | mismatch rate; change-task success; validation agreement (all from FS-1) |

**Self-healing rate** = errors resolved by automatic fixes ÷ all errors the checker reported, per run.
**False acceptance** = programs the arm's checks approved that fail hidden tests ÷ programs the checks approved.

---

## 7. Analysis and pre-registration

### 7.1 Statistics

- **Unit of analysis:** the seed (task). Runs are averaged per seed, and seeds are paired across languages. 95% intervals come from a bootstrap over seeds.
- **The comparison per cell:** Canon against the best other language for that family and model, with the baseline **chosen from pilot data before the main run** and recorded.
- **Outcomes per cell:**
  - **win:** the whole interval is above 0;
  - **non-inferior:** the interval's lower end is above the pre-registered margin (−m);
  - **lose:** the whole interval is below −m;
  - **inconclusive:** anything else.
- **The margin m and the run counts** come from a power analysis on the pilot, written down before the main run. State the smallest effect each family can detect.
- **Multiple comparisons:** "win" claims across the scoreboard use the Holm correction.

### 7.2 Predictions (committed before the run, including expected losses)

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

### 7.3 The win rule

**"Canon is the better language for AI agents"** is claimed only if, for **both** frontier models:
1. Canon is non-inferior or better in every family except cost, and
2. Canon wins, after Holm correction, in at least two families, one of which is FIX, CHANGE, THINK or FULL-STACK (READ alone is not enough, because of the annotation question).

**Partial outcomes are reported as what they are.** For example, "Agents understand Canon better and write it as well" is a valid, weaker finding.

### 7.4 Locked in the pre-registration

- every prompt template, word for word
- temperature, maximum tokens, number of runs
- model versions and quantization; Python, Node, mypy, ruff, tsc, eslint, Hypothesis, fast-check and Canon versions
- the item set, with a hash of every item file
- the rerun rule: rerun infrastructure failures (crashes, timeouts, API errors); never rerun wrong answers
- the analysis script, tested on pilot data, committed with a hash
- the API dollar cap per model

---

## 8. Quality controls

- **Every item verified:** references pass all tests and agree on fuzzed inputs; mutants fail; READ answers are confirmed by execution or by fuzzing and a solver.
- **Human spot check:** the owner reviews 10% of items in each family before the pilot, chosen at random.
- **No leakage:** a test confirms that no reference solution, and nothing close to one, appears in the Canon agent reference or the prompts.
- **Contamination noted:** the standard-benchmark subset is reported separately, because Python and TypeScript have likely seen those problems in training.
- **Balanced difficulty:** the pilot checks that no family sits at 0% or 100% for every language. Items that are trivial or impossible everywhere are replaced before the main run.

---

## 9. Harness layout

```text
research/canonbench/
  PREREGISTRATION.md      committed before the main run
  seeds/                  one JSON per seed: spec, signature, examples, tags
  refs/{canon,py,ts}/     idiomatic reference solutions
  tests/                  language-neutral hidden tests (JSON)
  adapters/               runners that apply JSON tests in each language
  sandbox/                execution limits and effect recording
  generators/             build READ, FIX, CHANGE and THINK items from seeds
  items/                  generated items, hashed
  arms/                   prompt templates and toolchain configs per language
  runner/                 reuses the Experiment 1 runner; adds GPT-6.2 Sol
  analysis/               the pre-registered analysis script
  results/                raw runs (JSON lines) and the scoreboard
```

---

## 10. Phases

**Phase 1: build and verify** (the agent works through these; each ends green and committed)
- [x] Seeds, references and language-neutral tests for all 120 seeds; equivalence checks pass. (76 seeds built; see research/canonbench/DECISIONS.md)
- [x] The sandbox with effect recording; adapters for all three languages.
- [x] Generators for READ, FIX, CHANGE and THINK; every item verified.
- [x] Python and TypeScript toolchain arms with patch feedback and property testing, matching Canon's.
- [ ] The owner's 10% spot check is done.

**Phase 2: pilot**
- [x] 10 seeds, every family, every arm, every model.
- [ ] Difficulty check; items replaced where needed.
- [x] Power analysis: margins and run counts per family.
- [x] Baselines chosen per family; pre-registration and analysis script committed.

**Phase 3: main run**
- [ ] Qwen runs locally first (no cost), then the API models with the cost check: run 20 items, project the total, and stop if it exceeds the cap.
- [ ] FS-1 runs as specified in its own pre-registration.

**Phase 4: report**
- [ ] The scoreboard, per-family charts, the annotation ablation, self-healing and false-acceptance results, costs, and every miss, written up for `/research` and as a short paper.

---

## 11. Size and cost (starting estimates; the power analysis sets the real numbers)

| Family | Items per language | Languages or arms | Runs | Total runs per model |
| --- | --- | --- | --- | --- |
| READ | about 480 | 3, plus stripped Canon | 3 | about 5,800 (single-turn, cheap) |
| WRITE | 120 | 3 | 3 | 1,080 |
| FIX | 240 | 3 | 3 | 2,160 |
| CHANGE | 120 | 3 | 3 | 1,080 |
| THINK | 120 × 2 targets | 2 | 3 | 1,440 |
| FULL-STACK | 60 | 3 | 3 | 540 |

**The budget plan:** run everything on Qwen locally. For the frontier models, run only as many items as the power analysis says each family needs, under a dollar cap per model set in the pre-registration.

---

## 12. Instructions for the agent

```text
Read docs/canonbench.md and docs/v0.5-fullstack.md fully. Build CanonBench under
research/canonbench/, phase by phase, reusing Experiment 1's tasks, tests and runner.

Rules:
- Python and TypeScript references are written idiomatically, never generated from Canon.
- Every item is verified before use (section 8); drop items that fail verification and
  record how many were dropped and why.
- Python and TypeScript arms get patch feedback and property testing matching Canon's.
- Nothing runs beyond the Phase 2 pilot until PREREGISTRATION.md and the analysis script
  are committed and I have approved them.
- Follow CLAUDE.md; record every judgment call in DECISIONS.md and keep going.

baselines, and the draft pre-registration. Also send me the 10% spot-check sample.
```

## Owner's run instructions (2026-11-22, overriding the approval gates above)

The owner asked for all four phases to run overnight with no approval stops: "dont stop after phase 2. keep going till all 4 phases are done ... I cannot give approval on anything as I will be sleeping ... make your best judgement and give me results by morning."

So, for this run:
- The approval gates (the 10% spot check, and approval of PREREGISTRATION.md and the analysis script) are not waited on. The spot-check sample is still drawn and saved for the owner to review afterwards, and PREREGISTRATION.md and the analysis script are still committed, with their hashes, **before** the main run starts. Committing before running is what makes them pre-registered; the owner's approval comes after the fact and is recorded as such.
- Every judgment call that the owner would otherwise have made is recorded in research/canonbench/DECISIONS.md and listed in the report.
