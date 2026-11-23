# CanonBench decisions

Every judgment call made while building and running CanonBench overnight (2026-11-22/23), unattended.
The owner asked for all four phases with no approval stops; each call the owner would otherwise have
made is recorded here (date, decision, reason). Approval of all of these is after the fact.

## Scope and size (made up front, 2026-11-22 23:50)

1. **Seeds: 60 Experiment 1 hard tasks + 16 new effectful seeds = 76, not 120.** The 30 standard
   benchmark problems (HumanEval+/MBPP+) were not built: each would need three idiomatic references,
   JSON tests and equivalence checks, and one night does not allow it. The 30 "new effectful
   problems" became 16, used for READ's effects questions only (they are module-shaped programs
   about which questions are asked, not single functions to write). Reason: the instructions say to
   prefer fewer fully verified items over many unverified ones.
2. **Families on the effectful seeds:** READ only. WRITE/FIX/CHANGE/THINK use the 60 hard tasks.
3. **Canon surface: brace syntax.** Experiment 1b has not reported; the plan says to use brace
   syntax and record it.
4. **Python 3.13, not 3.11.** The repo's pinned `.venv` (`pnpm pyenv`) is Python 3.13.12; the plan's
   "Python 3.11" was a floor, not a pin. mypy 2.4.1, ruff 0.17.6, Hypothesis 6.170.17 (added to the
   worktree's .venv), pytest 9.2.0.
5. **fast-check is not used.** It is not in the pinned lockfile and adding a dependency to the
   workspace was out of scope. The TypeScript arm's property step uses a dependency-free random
   input generator (lib/gen.ts) in the same role. Recorded as a deviation.

## References and verification

6. **Python references were written by hand from the specs** (three parallel authoring agents, each
   forbidden to read the Canon or TypeScript references), idiomatic: type hints, docstrings,
   stdlib, TypedDict/dict values fixed by the shared declarations. Canon and TypeScript references
   are Experiment 1's.
7. **Equivalence on 1,000 fuzzed inputs uses only in-spec inputs.** Fuzzed inputs that break a
   constraint the spec states in words ("grid is a rectangle", "coins are positive", "n is never
   negative"...) are outside the spec; the references legitimately differ there. These constraints
   are encoded, with the quoted sentence, in lib/preconditions.ts (12 seeds). Two constraints are
   CanonBench additions, not in the spec text: money amounts are non-negative (invoice_total,
   payroll_by_dept, settle_debts), because for negative amounts "rounded down" is floor in Python
   and TypeScript but truncation in Canon's `/`; and Int results stay inside Canon's 53-bit range
   (stack_vm: Canon traps with R003, Python and TypeScript do not). Result: 60/60 seeds agree on
   1,000 in-spec inputs in all three languages (results/equivalence.json).
8. **One Experiment 1 reference was wrong and was fixed:** the Canon vending_machine used -1 as a
   "no coin" sentinel, so a negative coin was treated as a refund instead of "reject C" (the spec
   says any other value is rejected). The Python and TypeScript references agreed with the spec.
   Fixed in refs/canon/vending_machine.cn (helper functions per event); Experiment 1's copy is
   untouched.
9. **next_permutation's Canon reference was rewritten slightly** (a match inside a lambda became a
   helper function `choose`) because the CB-1 fix makes the Python generator refuse a match inside a
   lambda (G002). The JavaScript behaviour is unchanged.
10. **CB-1 (compiler bug) was found by this benchmark and fixed on main before the main run**
    (COMPILER_ISSUES.md). Main was merged at 0a38eba before the pre-registration was committed, as
    the owner's coordinator recommended.

## Items

11. **READ question types:** output (one per seed, on a fuzzed in-spec input that is *not* a hidden
    test input), failure (Result-returning seeds where at least one error and enough successes were
    found: 22 seeds), property (one per seed where decidable), effects (16 seeds x 4 effect kinds).
    Effects questions ask about net, fs, time and rand; io and tables (`store`) are not covered:
    the effectful seeds were written without them (Python and TypeScript have no standard table
    API to mirror Canon's).
12. **Property ground truth:** "yes" needs an executed witness on which all three references agree
    (certain). "no" means no witness in 10,000 fuzzed inputs that include every hidden-test input;
    no solver was used. Because the question quantifies over every value of the declared types, a
    "no" is kept only for seeds with no stated preconditions (a fuzzer that respects preconditions
    cannot speak for out-of-spec inputs). I then read all 14 remaining "no" items against their
    specs and confirmed each by reasoning (e.g. bowling scores are sums of rolls validated to be
    0..10, so never negative). A first generation had wrong "no" answers (it excluded hidden-test
    inputs, among them the empty inputs) and was caught in this review and regenerated before the
    main run; the pilot ran on that first generation.
13. **Answer parsing is lenient in the same way for every arm:** the `ANSWER:` line, else the last
    fenced block, else the last line; Python-style `True/False/None` accepted. Qwen often ignores
    the ANSWER format.
14. **Stripped Canon** removes `requires:`, `ensures:` and `effects:` clause lines (and their
    `&&`/`||` continuation lines). It is shown with the same Canon reference in the system prompt.
15. **FIX mutation types: boundary, operator, constant (off by one).** The plan's other types
    (wrong field, swapped arguments, missing case, missing or undeclared side effect, wrong error
    branch) need per-language semantic matching and were not built. A mutant must pass its language's
    checker and fail at least one hidden test; both mutants of a seed use the same two types in all
    three languages. 53 seeds yield at least one matched type (48 two, 5 one); 7 seeds yield none and
    are absent from FIX. 101 items per language.
16. **CHANGE: 24 seeds**, not 120: one realistic requirement each, written by two authoring agents
    with updated references in all three languages (each an edit of that language's reference) and
    verified (new cases pass, regression cases pass, the original fails at least one new case).
    Only spiral_order changes the signature.
17. **WRITE prompts include two examples** (the first two hidden tests, as the plan specifies); they
    stay in the hidden test set.
18. **THINK (single programs) is THINK -> Python only; THINK -> TypeScript is reported as not yet
    possible.** Canon v0.5 has no TypeScript target for business logic (`canon build --module` emits
    JavaScript in Canon's runtime value representation, and the TS generator writes only types,
    validators and the client). Running compiled JS under TypeScript tests would not be "shipping
    TypeScript".
19. **THINK reuses the WRITE runs, with no extra model calls.** Direct = the WRITE Python run (same
    prompt and toolchain, so it is the Direct arm exactly). Through Canon = the WRITE Canon run's
    final program compiled by the shipped Python generator and run against the same hidden tests in
    Python. Consequence, stated in the report: the Canon arm never saw `canon build` errors as
    feedback (the generator's G00x refusals count as failures), and its prompt did not say the
    deliverable was Python. This saves a full arm of model calls.
20. **No visible-test feedback.** As in Experiment 1, a run stops when its checks approve; the hidden
    tests are never shown in any arm. A program whose checker is clean but whose property test fails
    after the last round is still tested (delivered); it counts as "not accepted".
21. **Automatic fixes** (canon check --fix, ruff --fix, eslint --fix) run before every check in
    every arm and never cost a round. Self-healing = errors the automatic fixes removed / errors the
    checker reported on programs as written.
22. **TypeScript programs that forget `export`:** a top-level function of the right name is called
    anyway (Canon and Python find functions by name too).

## Models and sampling

23. **GPT-6.2 Sol is `gpt-6.2-sol`** (listed by the OpenAI models endpoint on 2026-11-22), via Chat
    Completions with `reasoning_effort: "medium"`. **Claude Opus 5.5 is `claude-opus-5-5`** with
    adaptive thinking at effort "medium" (the Experiment 1 setting), server-side refusal fallback on.
24. **Temperature 0.2 applies only to Qwen.** Neither API model accepts a temperature: Opus 5.5
    rejects sampling parameters and GPT-6.2 Sol accepts only the default (1). Recorded as a deviation.
25. **Qwen2.5-Coder-7B-Instruct, MLX 8-bit** (mlx-community, snapshot b292f3cb), mlx_lm 0.32.2,
    served with batched decoding (`--decode-concurrency 8`), max 2,048 output tokens (1,024 for READ).
26. **Prices** (looked up 2026-11-22): Opus 5.5 $4 / $20 per million input / output tokens, cache
    reads $0.20, cache writes $5; GPT-6.2 Sol $2 / $10, cached input $0.10 (OpenAI pricing page).
    Spend is computed from the token usage each response returns (results/spend-*.json).

## Pilot and pre-registration (Phase 2)

27. **The 20-item cost check** was satisfied by the pilot, which ran at least 24 items per family per
    API model before any main-run call; the projection is in PREREGISTRATION.md. The runner also
    stops a model at its cap mid-run.
28. **The approval gates were not waited on** (owner's instructions). PREREGISTRATION.md, the
    analysis script and their hashes were committed before the first main-run call.
29. **Difficulty check: frontier models were at 100% on WRITE, FIX and CHANGE in the pilot, in
    every language.** The plan says trivial items are replaced before the main run. Harder items
    could not be built overnight, so all verified items are kept, and the ceiling is stated in the
    pre-registration as a known limit. Qwen 7B is far from ceiling in every family (and at 0% for
    Canon WRITE on the pilot seeds), so its cells are informative.
30. **Margin m = 10 points for every family**, chosen from the power analysis (Qwen cells' minimum
    detectable effects at the main run's seed counts); frontier cells had no pilot variance to
    estimate it from.
31. **Qwen run-major ordering and a 07:00 stop rule** so the local model cannot hold the report
    hostage; see PREREGISTRATION.md section 4.
