# DRAFT pre-registration: Canon v0.3 against v0.2, TypeScript and Python

**Status: draft for review. This is not a pre-registration yet.** It becomes one only when the owner
copies it to a dated `PREREGISTRATION-v0.3.md`, fills every `TBD`, and commits it before the first
run. Nothing here has been run; no model API was called while writing it. The design reasons are in
[docs/v0.3-proposal.md](../../docs/v0.3-proposal.md).

## What is being tested

v0.3 (SPEC.md, "Amendment: v0.3") makes eight changes, each with a switch. The bets, in the order
the proposal ranks them:

1. **Self-healing toolchain** (`check --fix`, plus line wrapping so L001 is mechanical): first-try
   validity rises to TypeScript's, and turns to correct fall to TypeScript's.
2. **Contract fuzzing** (`canon test`): fewer silent failures (code that checks clean, never
   crashes, and returns a wrong answer) on hard tasks, when the harness feeds counterexamples back.
3. **Sealed effects** (tests and contracts effect-checked, runtime capability guard): a checked
   program's effects are bounded by `main`'s signature. This is deterministic and is tested without
   models (tests/effects); the model experiment only checks that it costs nothing.
4. **Model-native spellings** (`&&`/`||`/`!`, `break`, `for (i, x) in`): fewer output tokens and
   fewer distinct programs.
5. **Ranked suggestions for T001**: fewer fix rounds on judgment errors.

The proposal also argues that the largest available gain is a change of surface (a strict,
effect-typed subset of Python syntax, "Canon-Py"). v0.3 does not build it; Experiment D below is
the cheap test that should come before anyone does.

## Arms (system prompts frozen at the commit that registers this file)

| Arm | Language and toolchain | Check step the harness runs |
| --- | --- | --- |
| `canon-v0.2` | Canon v0.2: CLI with `--v0.2`, reference = for-agents.mdx at commit `e044cae` | `canon check --json --v0.2` |
| `canon-v0.3` | Canon v0.3, every switch on, reference = for-agents.mdx at the registering commit | `canon check --fix --json` (the harness keeps the fixed source) |
| `canon-v0.3-nofix` | v0.3 language, but the harness runs plain `check` (ablates the self-healing loop) | `canon check --json` |
| `canon-v0.3-v02syntax` | v0.3 toolchain with `--no-symbols --no-break --no-destructure` (ablates the spelling changes) | `canon check --fix --json --no-symbols --no-break --no-destructure` |
| `typescript` | TypeScript strict, as in the v0.2 benchmark | `tsc --strict` (as in `research/benchmark/src/languages.ts`) |
| `python` | Python 3.12, type-annotated signatures | `mypy --strict` (TBD: pin version), same JSON-ish feedback shape as TypeScript |

The two remaining language switches (`--no-sealed-effects`, `--no-suggestions`) and the two
runtime switches (`--no-capability-guard`, `--no-contract-fuzz`) are ablated only in Experiment B,
where they can matter.

## Experiment A: the 50-task benchmark, rerun

- **Models:** `claude-opus-5-5` (effort `medium`, prompt caching on) and `gpt-6.2-sol`, as in v0.2.
- **Tasks and loop:** the same 50 tasks (`research/benchmark/src/tasks.ts`), 10 runs per (model,
  arm, task), the same loop (draft, checker feedback, at most 3 fix rounds, hidden tests). The
  Python arm needs Python versions of the task prompts and a Python test runner: the hand-written
  solutions in `research/v0.3/tokens/python/` validate that runner, and must pass it before the run.
- **Size:** 6 arms x 2 models x 50 tasks x 10 runs = 6,000 runs. TBD: the owner may drop
  `canon-v0.3-v02syntax` to save cost; if so, H4 below is reported as not tested.
- **Metrics** (as in PREREGISTRATION-v0.2.md, plus three):
  - *First-pass valid*: the draft checks clean. For `canon-v0.3`, the draft **after** `--fix` (the
    agent never sees the mechanical problems); the raw-draft rate is also reported.
  - *Turns to correct*, *Correct*, *Distinct programs*, *Structural distinct*, *Dollars per correct
    program* (Claude), *Output tokens per run*: unchanged definitions.
  - *Code tokens per correct program* (Qwen2.5-Coder tokenizer, as in research/v0.3/tokens) and
    *reasoning share* = 1 - code tokens / output tokens (a proxy, since provider tokenizers differ).
- **Intervals:** 95% bootstrap over tasks, 10,000 resamples, seed 2026. Paired by task.

### Decision rules (each must hold for both models; cost rules Claude only)

| # | Hypothesis | Supported when |
| --- | --- | --- |
| H1 | v0.3's self-healing loop closes the first-try gap | `canon-v0.3` first-pass valid (after `--fix`) >= TypeScript's minus 1 point, and its turns to correct <= TypeScript's + 0.05 |
| H1a | ... and the loop, not the language, does it | `canon-v0.3` first-pass valid minus `canon-v0.3-nofix`'s > 0, interval excluding 0 |
| H2 | v0.3 is cheaper than v0.2 | ratio of Dollars per correct program, `canon-v0.3` / `canon-v0.2`, upper interval bound < 1 |
| H3 | v0.3 reaches the cost bar v0.2 missed | Dollars per correct program `canon-v0.3` <= 1.5 x TypeScript's (C6 of v0.2) |
| H3p | ... and against Python | Dollars per correct program `canon-v0.3` <= 1.5 x Python's |
| H4 | the spelling changes cut output | output tokens per run, `canon-v0.3` / `canon-v0.3-v02syntax`, upper interval bound < 1 |
| H5 | convergence (the v0 and v0.2 C3 rule) | Distinct programs `canon-v0.3` <= 0.5 x TypeScript's, ratio interval upper bound < 1 |
| H5d | v0.3 converges more than v0.2 | ratio `canon-v0.3` / `canon-v0.2` of Distinct programs, upper bound < 1 |
| H6 | no correctness cost | `canon-v0.3` Correct >= 90% overall and >= 80% on the hard tier, and >= TypeScript's minus 5 points |

**Expected results, stated in advance** (so the reader can judge the proposal's calibration): H1
supported (the replay in research/v0.3/replay shows every recorded v0.2 first-draft failure was
mechanical); H1a supported; H2 uncertain (the loop saves fix rounds, which are about 2 to 10% of
runs; most of the cost is reasoning tokens in the first draft); H3 and H3p not supported; H4 not
supported (the spelling changes are token-neutral in code; any saving must come from less
deliberation); H5 and H5d not supported (decomposition and naming dominate the variation); H6
supported.

## Experiment B: hard tasks, weaker models (extends Experiment 1)

Experiment 1 (`research/exp1/`, being built; not modified here) compares three setups with the same
budget (a draft plus at most 3 fix rounds) on hard tasks: `ts-plain`, `ts-patch` (TypeScript errors
with quick-fix patches) and `canon` (v0.2), on local Qwen2.5-Coder 1.5B, 7B and 14B (MLX, temperature
0.7, top_p 0.8) and `claude-haiku-5-5`, with **pass rate** (checks clean and passes every hidden
test) and **silent-failure rate** (checks clean, never crashes, at least one wrong answer). This draft
adds arms to the same harness, with the same tasks, models, budget and sampling:

| Arm | Description |
| --- | --- |
| `canon-v0.3` | v0.3, harness runs `check --fix`; after the check is clean, it runs `canon test --json` on the program (contract fuzzing); a fuzz counterexample is returned to the model as feedback and costs one fix round |
| `canon-v0.3-nofuzz` | the same with `--no-contract-fuzz` (ablates fuzzing) |
| `canon-v0.3-nofix` | the same with plain `check` (ablates the self-healing loop) |
| `canon-v0.3-nosuggest` | the same with `--no-suggestions` |
| `python` | typed Python with `mypy --strict` errors (no patches), to place Canon against the language these models know best |

Prompt for the fuzzing arms adds one sentence: "State what the function guarantees with `requires:`
and `ensures:` where you can; `canon test` checks them on generated inputs." (TBD: the owner decides
whether the same sentence is added to the non-fuzz arms, which keeps prompts equal but makes contracts
useless there. Recommendation: add it to every Canon arm.)

| # | Hypothesis | Supported when (per model; reported for each, summarized across) |
| --- | --- | --- |
| B1 | v0.3 raises pass rate over v0.2 on weak models | `canon-v0.3` pass rate - `canon` pass rate > 0 with interval excluding 0, for at least 2 of the 3 Qwen models |
| B2 | contract fuzzing cuts silent failures | `canon-v0.3` silent-failure rate < `canon-v0.3-nofuzz`'s, interval of the difference excluding 0, pooled over models |
| B3 | Canon v0.3 beats TypeScript with patches on silent failures | `canon-v0.3` silent-failure rate < `ts-patch`'s, interval excluding 0, pooled |
| B4 | the self-healing loop matters more for weak models | (`canon-v0.3` - `canon-v0.3-nofix`) pass-rate gain is larger for Qwen 1.5B than for Haiku (point estimates, reported descriptively) |
| B5 | contracts get written | share of `canon-v0.3` final programs with at least one `ensures` (descriptive; if below 20%, B2 is reported as "not testable", not as "not supported") |

Expected: B1 supported for 1.5B and 7B (their v0.2 failures include formatting the loop now fixes);
B2 small or not testable (weak models rarely write contracts unprompted); B3 not supported.

## Experiment C: sealed effects (no models)

The claim "you can know what checked Canon can do before running it" is tested deterministically:

- tests/effects (committed) must keep passing: every smuggling attempt is rejected (E101/E103) or
  bounded by `main`'s declared effects, and the forged-module test shows the runtime guard stops an
  effect the checker missed.
- Before the claim is published, an independent red team (a person, or a model session that has not
  seen tests/effects) gets 2 hours to add programs that perform an effect `main` does not declare.
  Supported when none passes `canon check` and runs that effect under the default guard. Every
  attempt, successful or not, is added to tests/effects.
- With models: in Experiment A, count programs that fail only on E101/E102/E103 in tests (cost of
  sealing). Supported (no cost) when that count is under 1% of runs.

## Experiment D: surface syntax, before building Canon-Py (offline, then a small model run)

research/v0.3/surprisal measured that Canon-Py, a strict subset of typed Python syntax with Canon's
rules, has about the same total surprisal as plain typed Python under Qwen2.5-Coder and much lower
surprisal than Canon v0.2 syntax, even when Canon is conditioned on its reference. That measurement
used hand-written programs and base models. Before the language is rebuilt:

1. **Held-out offline check.** A person who has not seen the 50 tasks writes 20 new tasks, with
   solutions in Canon v0.3 and Canon-Py by two other people (blind to the hypothesis). Score with the
   same models and prefixes. Supported when Canon-Py's total surprisal is lower than Canon v0.3's
   (with reference) with the paired interval excluding 0, for both model sizes.
2. **Instruction-model check.** With a prototype Canon-Py checker (parser and printer only, which is
   enough to accept or reject canonical text), run Experiment A's loop on the 50 tasks with
   `claude-haiku-5-5` and Qwen 7B only, arms `canon-v0.3` and `canon-py`, 5 runs each. Supported when
   Canon-Py's output tokens per correct program are lower than Canon v0.3's with the interval
   excluding 0 for both models. This is the cheapest test of the proposal's central claim: that
   familiarity (low surprisal) reduces reasoning tokens, which are most of the cost.

## Exclusions and stopping

As in PREREGISTRATION-v0.2.md: runs served by a fallback model are excluded; API failures are
retried, never counted; a run is never re-sampled because of its result. No interim looks at
outcome metrics; the harness may be stopped only for infrastructure failure, and then resumed with
the same seeds.

## What may be said afterwards

Only supported hypotheses are stated as findings, scoped to these models and tasks. Differences
whose interval includes 0 are "no difference detected". With 9 primary rules in Experiment A, the
report also states which survive a Holm correction at 0.05 (using the bootstrap p-values), and the
proposal's claims are made only for those.
