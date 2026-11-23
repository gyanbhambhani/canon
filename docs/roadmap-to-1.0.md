# Canon: roadmap to 1.0

Written 2026-11-22. Each version has a goal, a design sketch, its risks and one **proof point**: a pre-registered experiment whose success criteria are committed before it runs. **A version starts only after the previous version's proof point has run and been published, whichever way it went.** A failed proof point does not stop the roadmap; it changes it, and the change is recorded in DECISIONS.md.

## Where Canon stands

- **v0 and v0.2:** two pre-registered benchmarks, 2,000 runs each (Claude Opus 5.5 and GPT-6.2 Sol, 50 tasks, Canon against TypeScript).
  - Supported: agents wrote correct Canon from its reference alone, as reliably and in as few tries as TypeScript.
  - Not supported: convergence (fewer distinct programs) and cost (about 1.9 times TypeScript per working program).
  - The tasks were too easy to separate the languages; see [/research](https://canon-lake.vercel.app/research).
- **v0.3 (released, 0.3.0):** a self-healing toolchain (`canon check --fix`), sealed effects with a run-time capability guard, contract fuzzing, T001 fix suggestions, `break`, `for (i, x) in` and `&&`/`||`/`!`. Every change has an ablation switch. v0.3 has not been benchmarked yet.
- **Experiment 1** (harness built, calibration pilot paused at 148 of 480 runs): 60 hard tasks (537 hidden tests) where small local models fail often. Setups: Python, TypeScript, TypeScript with quick-fix patches, and Canon. Local Qwen2.5-Coder 1.5B, 7B and 14B, plus claude-haiku-5-5. Metrics: pass rate and silent failures (code that type-checks and runs but returns wrong answers). In the pilot so far, the 7B in Python passes about a third of tasks and fails silently in about 44% of runs.

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
  - On matched algorithms, Canon-Py beat Canon's own syntax by 14 to 17 nats.
  - Smaller syntax edits (dropping `let`, indentation alone, implicit return) made surprisal worse.
  - About 80% of Claude's Canon output was reasoning rather than code, which is consistent with "unfamiliar language" being the main cost.
- **The limits:** surprisal is a proxy, measured with base models on hand-written programs, not on agents writing code. It does not show that agents write correct code faster.
- **The rule that follows:** v0.4 ships Canon-Py behind a switch, and the current brace syntax stays the default until Experiment 1 compares the two on the hard tasks. Canon-Py becomes the default only if it is at least as correct as v0.3 syntax with lower cost. Otherwise it stays an option, and the finding is published either way.

**Proof points (both pre-registered before running).**
- **Experiment 1:** Canon v0.4, with its toolchain switches on and off and in both syntaxes, against Python, TypeScript and TypeScript with patches, on the 60 hard tasks, with the local Qwen sizes and claude-haiku-5-5. The question: does Canon raise the pass rate and cut silent failures for small models, and is the gain from the language or from the patch loop?
- **Experiment 2 (moved here from later):** can unwanted side effects in agent-written code be caught before running it? Tasks hide prompt-injection-style requests to send data out or touch files. Measure how many unwanted effects are caught before execution in Canon (declared effects plus the capability guard) against the best static checks available for Python and TypeScript. Red-team the effect checker for ways to sneak an effect past it. The limitation is stated up front: v0.4's guarantee is program-level, because a function declared pure can still perform effects passed to it as a function value. v0.7 closes that.

**Gate to v0.5:** Experiments 1 and 2 have run and been published.

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

**Goal.** Make "you know what agent code can do before running it" true per function and at the machine level, not just per program.

**Design.**
- Effects on function types, so a pure function cannot perform an effect passed to it.
- A WebAssembly backend, with effects as capabilities granted at launch.
- Experiment 2's red-team suite becomes a permanent regression test.

**Proof point.** Experiment 2 repeated per function and under the sandbox: no unwanted effect performed. Every smuggling attempt from the red-team suite is either rejected by the checker or denied at run time.

**Gate to 1.0:** the v0.7 proof point has run and been published.

## 1.0: the compiler in the loop

**Goal.** A developer writes intent in plain text. The agent writes Canon directly, with the compiler steering every token, so a finished program is well-typed, effect-exact and in canonical form by construction. Holes become questions answered by synthesis (v0.5) or by the developer.

**Design.**
- A prefix automaton and type-inhabitation search in the style of Mündler et al., extended beyond types to effects (a token that would perform an undeclared effect is masked) and to canonical form (only canonical texts can be produced). Canon's small type system (no overloading, no subtyping, local inference only) should allow complete constraint rather than a subset, which is the main difference from the TypeScript prior work.
- Runs on top of the v0.6 Canon-tuned model and the v0.5 synthesis and library.

**Constraint: open-weight models only.** Constrained decoding needs control over every token the model samples, which means running the model yourself: Qwen, Llama, DeepSeek and similar. Closed APIs (Claude, GPT) do not expose per-token control of that kind. For them, 1.0 falls back to v0.3's write, check, `--fix` loop. That fallback is a real limitation for teams that standardize on closed models.

**Proof point: beat the prior work.**
- Pre-registered, with the same open-weight models and tasks for both arms: Canon with Canon-constrained decoding, against TypeScript with the released type-constrained decoding of Mündler et al.
- Tasks: TypeScript and Canon versions of their HumanEval and MBPP setup, plus Experiment 1's hard tasks.
- Measures: compile errors (Canon's target is zero by construction for types, effects and form), pass@1, silent failures, and tokens and latency per correct program.
- 1.0 means beating that published bar on correctness and cost, not merely matching it.

### What Canon is at 1.0 is a decision, not an assumption

The compiler-in-the-loop layer does not need Canon's syntax, so 1.0 could take one of three shapes:

1. **A language people adopt directly.** Hardest: new languages rarely get adopted.
2. **A toolchain for any language:** the constrained-decoding and patch layer for Python or TypeScript. Easiest to adopt and the biggest market, but crowded, and only as strong as each language's own checks. Python's types are optional, and neither Python nor TypeScript has declared effects or one canonical form.
3. **The language agents write, compiled into the language humans use.** The agent writes Canon with every check on; what ships is readable TypeScript or Python. Teams keep their stack. Canon already compiles to JavaScript.

The experiments decide which shape:
- If TypeScript with patches matches Canon in Experiment 1, the value is the loop: option 2.
- If Canon beats TypeScript with patches, the strictness itself helps: option 3.
- If Experiment 2 shows declared effects catch what static analysis of Python and TypeScript misses, that is evidence only a language with effects can provide: option 3.

The decision and its evidence are recorded in DECISIONS.md before 1.0 work starts.

## Out of scope until 1.0

- A native (non-JavaScript, non-WebAssembly) backend.
- A package manager, and modules beyond the standard library.
- Concurrency.
- Editor language servers.
