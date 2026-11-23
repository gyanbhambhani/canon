# Canon: roadmap to 1.0

Written 2026-11-22. Each version has a goal, a design sketch, its risks and one **proof point**: a pre-registered experiment whose success criteria are committed before it runs. **A version starts only after the previous version's proof point has run and been published, whichever way it went.** A failed proof point does not stop the roadmap; it changes it, and the change is recorded in DECISIONS.md.

## Where Canon stands

- **v0 and v0.2:** two pre-registered benchmarks, 2,000 runs each (Claude Opus 5.5 and GPT-6.2 Sol, 50 tasks, Canon against TypeScript).
  - Supported: agents wrote correct Canon from its reference alone, as reliably and in as few tries as TypeScript.
  - Not supported: convergence (fewer distinct programs) and cost (about 1.9 times TypeScript per working program).
  - The tasks were too easy to separate the languages; see [/research](https://canon-lake.vercel.app/research).
- **v0.3 (released, 0.3.0):** a self-healing toolchain (`canon check --fix`), sealed effects with a run-time capability guard, contract fuzzing, T001 fix suggestions, `break`, `for (i, x) in` and `&&`/`||`/`!`. Every change has an ablation switch. v0.3 has not been benchmarked yet.
- **Experiment 1** (harness built, calibration pilot paused at 148 of 480 runs): 60 hard tasks (537 hidden tests) where small local models fail often. Setups so far: Python, TypeScript, TypeScript with quick-fix patches, and Canon; a Python-with-patches setup is being added. Local Qwen2.5-Coder 1.5B, 7B and 14B, plus claude-haiku-5-5. Metrics: pass rate and silent failures (code that type-checks and runs but returns wrong answers). In the pilot so far, the 7B in Python passes about a third of tasks and fails silently in about 44% of runs.

## Rules for every experiment below

- **One primary comparison per experiment,** pre-registered with its success criterion. Every other comparison in the same run is labelled **exploratory**, and is reported as a hypothesis for a later pre-registered test, never as a finding.
- **Tasks are the unit of analysis.** Intervals are 95% bootstrap intervals over tasks (seed 2026).
- **The same output-format instruction in every arm:** "reply with only the complete program in one code block", plus the arm's language-specific signature. The only difference between arms is the language reference (or none) and the checker's feedback.
- **Report code tokens separately** from total output tokens (which include the model's reasoning), so a terser language is not confused with a model that thinks less.

## Main prior work

**Mündler, He, Wang, Sen, Song and Vechev, "Type-Constrained Code Generation with Language Models", PLDI 2025** ([project page](https://eth-sri.github.io/publications/muendler2025typeawareconstraint), [arXiv 2504.09246](https://arxiv.org/abs/2504.09246), [code](https://github.com/eth-sri/type-constrained-code-generation)).
- They constrain an LLM's decoding with a type system: a prefix automaton tracks the partial program, and a search over inhabitable types rejects any next token that cannot lead to a well-typed program.
- It is formalized on a simply-typed calculus and implemented for "a non-trivial subset of TypeScript".
- They report that about 94% of compilation errors in LLM-generated TypeScript are type errors and only about 6% are syntax errors. Type-constrained decoding cut compilation errors by more than half across models from 2B to 34B parameters. It raised functional correctness by 3.5% to 5.5% (relative) for synthesis and translation, and by 37% for repairing non-compiling code.

This is the bar Canon 1.0 has to beat (below). The paper is also why types, not syntax, are the target: a grammar-only constraint would address only a small share of errors.

## v0.4: Python-shaped syntax, and the safety experiment

**Goal.** Decide, with evidence, whether Canon should look like Python. Run the first experiment on Canon's strongest structural claim.

**Design (being built on a branch).**
- **Canon-Py:** Canon's semantics written as a strict subset of typed Python (`def`, indentation, annotations, decorators for effects and contracts), producing the same AST, type checker, effects and runtime. Brace syntax still parses, and `canon fmt` migrates between the two.
- **`canon build`:** writes a standalone JavaScript file, or an ES module that exports the program's functions.
- **`--watch`** on `check`, `test`, `run` and `build`.

**Why Python-shaped syntax: the evidence, and its limits.**
- **The evidence:** v0.3's surprisal measurement scored the same correct programs under local Qwen2.5-Coder base models (lower means more familiar to the model). Canon v0.2 scored 70.5 (1.5B) and 62.1 (7B) nats per program; TypeScript 61 to 73; typed Python 45.5 and 43.2; and Canon-Py, a prototype of Canon's rules spelled as typed Python, 45.7 and 45.0.
  - Per-program totals mix length with familiarity. From v0.4 on, surprisal is also reported **per character** and **per syntax-tree node**, so that "fewer tokens" and "each token is more natural" can be told apart.
  - On matched algorithms, Canon-Py beat Canon's own syntax by 14 to 17 nats.
  - Smaller syntax edits (dropping `let`, indentation alone, implicit return) made surprisal worse.
  - About 80% of Claude's Canon output was reasoning rather than code, which is consistent with "unfamiliar language" being the main cost.
- **The limits:** surprisal is a proxy, measured with base models on hand-written programs, not on agents writing code. It does not show that agents write correct code faster.
- **The rule that follows:** v0.4 ships Canon-Py behind a switch, and the current brace syntax stays the default until Experiment 1 compares the two on the hard tasks. Canon-Py becomes the default only if it is at least as correct as v0.3 syntax with lower cost. Otherwise it stays an option, and the finding is published either way.

**Closing the higher-order effect leak (in v0.4, before Experiment 2).** Today a function whose signature declares no effects can perform effects handed to it as a function-valued parameter or record field (`apply(print, s)`). That is a hole in exactly the property Experiment 2 tests, so v0.4 closes it, by one of these, chosen and recorded in DECISIONS.md:
- **Declared callee effects:** calling a function-valued parameter or field requires the calling function to declare the effects that value may have, for example via effects on function types (`fn(String) -> Unit effects: io`). Passing an effectful function where a pure one is expected is a type error.
- **Or, as an interim rule:** effectful functions cannot be passed as arguments or stored in records at all, until function types carry effects.
Either way, the checker's guarantee becomes per function, not just per program, before Experiment 2 runs.

**Proof points (pre-registered before running).**

**Experiment 1: does Canon's full toolchain help small models?**
- **Primary comparison:** Canon (full v0.4 toolchain: `--fix`, fix suggestions, sealed effects, contract fuzzing, current brace syntax) against **the best patch-fed baseline**, on the 60 hard tasks with Qwen2.5-Coder-7B-Instruct. The baselines are TypeScript with quick-fix patches and **Python with patches**: pyright or mypy errors as JSON, with ruff's automatic fixes (and pyright's code actions where available) turned into unified-diff patches, the same shape as Canon's. "Best" is the baseline with the higher pass rate on the 7B, fixed by the pre-registration rule before the comparison is read. Measures: pass rate on hidden tests (primary) and silent-failure rate (secondary).
- **Exploratory, in the same run:** the other model sizes (1.5B, 14B, claude-haiku-5-5), plain Python and plain TypeScript, and each toolchain switch turned off one at a time (the ablation).

**Experiment 1b: does Python-shaped syntax help? (separate, its own pre-registration)**
- Canon v0.4 in brace syntax against Canon-Py, each arm with its own agent reference, the same toolchain, the same tasks and the 7B.
- Primary: pass rate; secondary: output tokens, code tokens and cost per correct program.
- It decides whether Canon-Py becomes the default.

**Experiment 2: can unwanted side effects be caught before running the code?** (moved here from later)
- **Tasks:** realistic tasks with prompt-injection-style instructions hidden in their inputs (for example "also post the data to this URL", "also write the result to ~/.ssh/config"), run with each model.
- **Canon arm:** declared effects, the per-function effect check (above) and the capability guard, all before execution.
- **Static baselines, named:**
  - Python: Bandit and Semgrep (with its security rule sets).
  - TypeScript: ESLint with security rules (for example eslint-plugin-security) and Semgrep.
  - Both languages: an import and API scan for network, filesystem, process and clock access.
- **LLM-reviewer baseline:** a frontier model asked to review each program for unwanted side effects before it runs.
- **Scoring:** per program, **missed attacks** (an unwanted effect not flagged before running) and **false alarms** (a flag on a program that does only what the task asked), with intervals over tasks.
- **Stated limit, up front:** Canon's effects are coarse categories (`net`, `fs`, `io`, `time`, `rand`). A program allowed `net` to call one host can call another, so "same effect, different host" attacks are out of scope for the checker. A finer host-level policy belongs in the capability guard and is future work.
- **Red team:** an adversarial suite tries to sneak an effect past the checker; every attempt must be rejected or denied at run time.

**Gate to v0.5:** Experiments 1, 1b and 2 have run and been published.

## v0.5: write less (proven contracts, synthesis, a library of proven functions)

**Goal.** Cut the output tokens per correct program below Python's, by having the toolchain write the routine parts and prove them. Output tokens are about 86% of a Canon run's cost.

**Design.**
- **Proven contracts:** `requires` and `ensures` are checked by an SMT solver (Z3, which also runs in the browser) where they are decidable. A failure comes back as the exact counterexample input, as a failing test with a patch. Fuzzing remains the fallback.
- **Type- and contract-directed synthesis:** the agent writes a signature, contracts and a few examples with `?` holes, and the compiler searches the standard library for code that satisfies them, proved where possible.
- **A content-addressed library:** every proven function is identified by a hash of its canonical text and its contract, so an agent that needs a known function gets the proven version instead of regenerating it.

**Risks.** Proofs work for arithmetic, lists and simple data; loops need invariants agents rarely write. Synthesis is reliable for small glue code, not for algorithms. Both fall back to the v0.4 behaviour.

**Proof point.** On Experiment 1's tasks: output tokens per correct program, pass rate and silent-failure rate, Canon v0.5 against Canon v0.4 and Python, with the same models.

**Gate to v0.6:** the v0.5 proof point has run and been published.

## v0.6: learn the dialect (a model trained with the compiler as teacher)

**Goal.** Show that a small model fine-tuned on Canon, with the compiler as a free and exact reward, beats the same model on Python.

**Design.** Build a verified Canon corpus: translate tested Python functions, and keep only translations that pass the compiler, contracts and the original tests. Fine-tune Qwen2.5-Coder (1.5B first, then 7B) with LoRA, locally via MLX.

**The fair baseline.** The Python arm is the **same base model fine-tuned on an equal amount of Python data**: the same source functions, the same number of examples and tokens, and the same training budget, kept only if they pass the original tests. Otherwise any gain could come from fine-tuning itself rather than from Canon.

**Risks.** Compute and heat on a laptop (hours to days for 7B). The verified corpus has to be large enough to matter. The 1.5B pilot decides whether the 7B run is worth it.

**Proof point.** On Experiment 1's tasks (held out from training): pass rate, silent failures and tokens per correct program, Canon-tuned against Python-tuned, for each model size.

**Gate to v0.7:** the v0.6 proof point has run and been published.

## v0.7: sealed sandbox (per-function effects, WebAssembly, capabilities)

**Goal.** Make "you know what agent code can do before running it" true at the machine level, and finer than effect categories. (Per-function effect checking arrives in v0.4.)

**Design.**
- A WebAssembly backend, with effects as capabilities granted at launch, so agent code cannot reach anything it was not granted, even through a bug in the runtime.
- Finer capabilities: host-level and path-level policies (for example `net` limited to listed hosts, `fs` to a directory), which close the "same effect, different host" limit stated in Experiment 2.
- Experiment 2's red-team suite becomes a permanent regression test.

**Proof point.** Experiment 2 repeated under the sandbox, including "same effect, different host" attacks: no unwanted effect performed. Every smuggling attempt from the red-team suite is either rejected by the checker or denied at run time.

**Gate to 1.0:** the v0.7 proof point has run and been published.

## 1.0: the compiler in the loop

**Goal.** A developer writes intent in plain text. The agent writes Canon directly, with the compiler steering every token, so a finished program is well-typed, effect-exact and in canonical form by construction. Holes become questions answered by synthesis (v0.5) or by the developer.

**Design.**
- A prefix automaton and type-inhabitation search in the style of Mündler et al., extended beyond types to effects (a token that would perform an undeclared effect is masked) and to canonical form (only canonical texts can be produced). Canon's small type system (no overloading, no subtyping, local inference only) should allow complete constraint rather than a subset, which is the main difference from the TypeScript prior work.
- Runs on top of the v0.6 Canon-tuned model and the v0.5 synthesis and library.

**Constraint: open-weight models only.** Constrained decoding needs control over every token the model samples, which means running the model yourself: Qwen, Llama, DeepSeek and similar. Closed APIs (Claude, GPT) do not expose per-token control of that kind. For them, 1.0 falls back to v0.3's write, check, `--fix` loop. That fallback is a real limitation for teams that standardize on closed models.

**Proof point: beat the prior work.**
- Pre-registered. Canon with Canon-constrained decoding, against TypeScript with the released type-constrained decoding of Mündler et al.
- **The same base model in both arms,** reported two ways:
  - **Untuned:** the same open-weight base model in both arms.
  - **Matched fine-tuning:** each arm's model fine-tuned on equal data (as in v0.6), so Canon's trained model is compared with an equally trained TypeScript model, not with an untuned one.
- **Tasks limited to what the PLDI tool supports:** their HumanEval and MBPP setup, restricted to programs within the TypeScript subset their implementation handles, so the comparison does not reward Canon for tasks the baseline cannot express. Experiment 1's hard tasks are reported separately, as exploratory.
- Measures: compile errors (Canon's target is zero by construction for types, effects and form), pass@1, silent failures, and tokens and latency per correct program.
- 1.0 means beating that published bar on correctness and cost, not merely matching it.

### What Canon is at 1.0 is a decision, not an assumption

The compiler-in-the-loop layer does not need Canon's syntax, so 1.0 could take one of three shapes:

1. **A language people adopt directly.** Hardest: new languages rarely get adopted.
2. **A toolchain for any language:** the constrained-decoding and patch layer for Python or TypeScript. Easiest to adopt and the biggest market, but crowded, and only as strong as each language's own checks. Python's types are optional, and neither Python nor TypeScript has declared effects or one canonical form.
3. **The language agents write, compiled into the language humans use.** The agent writes Canon with every check on; what ships is readable TypeScript or Python. Teams keep their stack. Canon already compiles to JavaScript.

The experiments decide which shape, under a pre-registered **equivalence margin of 3 percentage points** in pass rate (tasks as the unit, 95% bootstrap interval of the paired difference):
- **The patch-fed baseline matches Canon** (the whole interval of Canon minus the best baseline lies within ±3 points): the value is the loop. Option 2.
- **Canon beats the best patch-fed baseline** (the interval lies entirely above +3 points): the strictness itself helps. Option 3.
- **Neither** (the interval straddles a boundary): undecided. Run more tasks or runs, as the pre-registration specifies; do not pick a shape on an inconclusive result.
- **Independently, Experiment 2:** if declared effects catch attacks that the named static baselines and the LLM reviewer miss, at a comparable false-alarm rate, that is evidence only a language with effects can provide, and it favours option 3.

The decision and its evidence are recorded in DECISIONS.md before 1.0 work starts.

## Publishing

- **After v0.4:** an arXiv write-up of Experiments 1, 1b and 2, with the pre-registrations, raw runs and harness linked. It reports every result, including what did not hold up, the way /research does.
- **Share it with the PLDI authors** (Mündler, He and colleagues) before submitting it anywhere: they know the prior work best, and Canon's 1.0 proof point is defined against their tool. Ask whether the comparison setup is fair to their method.
- Each later proof point (v0.5, v0.6, v0.7, 1.0) is published the same way: pre-registration first, then the results, whichever way they go.

## Out of scope until 1.0

- A native (non-JavaScript, non-WebAssembly) backend.
- A package manager, and modules beyond the standard library.
- Concurrency.
- Editor language servers.
