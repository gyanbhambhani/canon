# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

## 2026-11-22 — Website redesign: data, fixtures and the design canvas
Decision: the redesign brief (landing, docs, playground, /research, README, npm metadata) is built from its written spec. The design canvas it links (a claude.ai artifact) is behind the owner's login, so layout, copy and tokens follow the brief's sections 6 and 10 exactly instead.
Reason: CLAUDE.md says not to stop for questions; the brief gives exact copy, tokens, sizes and structure, which is enough to build from.

Decision: every figure comes from `scripts/stats.ts`, which now recomputes the benchmark from `research/benchmark/results/runs.jsonl` (same rules and bootstrap seed as `report.ts`) and the likelihood rows from `research/likelihood/results`. `apps/web/test/site-data.test.ts` checks the verdicts and C3 intervals against REPORT.md; `apps/web/test/numbers.test.ts` fails if a page source contains any generated figure.
Reason: CLAUDE.md requires website numbers to come from stats.ts; recomputing (instead of parsing REPORT.md) also gives the confidence intervals and ranges the new pages need.

Decision: whether v0.2 "adopted" a spelling the likelihood study preferred is decided by the formatter: the v0 spelling no longer formats to itself, and it formats to the same text as the alternative. Today that marks `x = e`, `while` and `+` as adopted and `&&`, inline effects and dropped trailing commas as not.
Reason: keeps the /research table true as the language changes, with no hand-kept list.

Decision: the site leads with the v0.2 benchmark (the current language; REPORT-v0.2.md) and keeps v0 (REPORT.md) as the earlier run. Verdicts are read from the generated reports' tables, since v0.2 adds criteria (C3s, C6, D1, D1s); C1 to C4 are also recomputed from the raw runs and a test checks they agree. The brief's note "Not improved yet; v0.2 targets it" became "Not improved yet, in v0 or v0.2", and its cost line ("the reference rides in every prompt") gives way to the v0.2 finding that output tokens drive cost.
Reason: the v0.2 run finished while this work was under way (4ba4d68), and D1 (v0.2 improves convergence) was not supported. The brief's rule that every claim maps to a SUPPORTED verdict outranks its copy.

Decision: the hero terminal is generated at build time by running the CLI's `main()` on `examples/mistakes/missing-effect.cn`, applying the patch from `check`, and asserting that the result equals `examples/hello.cn`. The transcript keeps the CLI's real `--- a/` / `+++ b/` header and `1 problem` lines, which the brief's mock-up omits.
Reason: the brief says verbatim from the compiler, and verbatim wins over the mock-up. Mistake fixtures live in `examples/mistakes/` so the CLI tests, which require every top-level example to pass, are unaffected.

Decision: the GitHub button and links stay behind `NEXT_PUBLIC_GITHUB_URL` (set on Vercel), as in M6.
Reason: the existing tests and DEPLOY.md depend on that contract; production shows the button.

Decision: Geist comes from the `geist` package via `next/font`; `next-themes` (the same version Fumadocs uses) is a direct dependency so the nav's sun/moon toggle shares the Fumadocs provider's state. Home, /research and /play use a custom nav (`components/site/nav.tsx`); the docs keep Fumadocs' layout with the same wordmark and links, and all Fumadocs colors are mapped onto the new tokens.
Reason: the brief asks for one provider and one set of color roles across the site.

## 2026-11-22 — Language v0.2
Decision: four language changes, each traced to M8 data.
1. Assignment is `x = e` / `p.field = e` (on a `var`); `set` is retired. Likelihood study: `set x = ...` was about 2,600 to 4,000 times less likely than `x = ...` under both models. Mutations stay searchable: they are the `var` bindings and the `NAME =` lines.
2. The condition loop is `while cond { }`; `for` is only `for x in xs`. Likelihood study: `for cond` was 50 to 750 times less likely. One construct per job still holds: `for` walks, `while` repeats.
3. Strings join with `+`; the `concat` built-in is removed. Likelihood study: `concat(a, b)` was 14 to 50 times less likely than `a + b`. String + Int is still T001.
4. `match` may appear in any expression position; S001 is retired. Benchmark: with `match` limited to let/set/return, models invented varied workarounds (helper functions, flag variables).
Canonical form: a `match` that is the whole value of a `let`, an assignment or a `return` stands alone; anywhere else (an operand, an `if` condition, a lambda body) it is parenthesized, so `(match a { ... }) * 2` cannot be misread as part of the last arm. A call argument needs no extra parentheses.
T006 now reads "cannot assign to n, which is not a var" (it used to say "set on n").
The agent reference (For agents page, /llms.txt) was trimmed from about 9,800 to about 7,000 characters, because it is the main cost of a Canon run.
Migration: the lenient parser still accepts `set x = e`, `for cond { }` and `concat(...)`, and fmt rewrites them (C001 with the patch), so `canon fmt --write` migrates any v0 file. `concat(...)` is left alone in a program that defines its own `concat`.
Oracle: reference/canon.py stays the spec for everything v0.2 did not change. The conformance test still requires byte equality on every file that touches none of these constructs; a file that does may differ only on those lines, and v0.2 fmt must equal fmt of the oracle's output.
Tests changed because the language changed (not to make them pass): `tests/types/fail/t001_string_plus.cn` (String + String is now legal; the file now tests String + Int); the fuzz test fuzzes the v0.2 canonical form of the oracle-canonical files; the corpora, examples and run programs were migrated with fmt.

## 2026-11-22 — M7: release
- `canon-lang` is published from packages/cli as one esbuild bundle plus README and LICENSE (32 kB packed). It was verified by installing the packed tarball into an empty directory and running `npx canon run hello.cn`.
- The repository already existed with an MIT LICENSE ("Copyright (c) 2026 Gyan"), so the build kept it and based its history on that initial commit.
- The web type-check generates lib/generated/site.json first (`pnpm run stats`), because that file is gitignored build output. CI failed on a clean checkout without it.

## 2026-11-22 — M6: website choices
- The whole site is a static export (`output: "export"`): no server is needed, the playground included. The compiler runs on the page; programs run in a Web Worker that is terminated after 2 seconds.
- The playground keeps its source in the URL hash as base64url UTF-8 (`/play#code=...`). Apply uses `applyPatch` (compiler), which reads a diff with the source lines in hand, because difflib-format patches for a file with no final newline glue two lines together (the system `patch` tool rejects those).
- `scripts/stats.ts --write` produces `apps/web/lib/generated/site.json` (gitignored) at build time: the numbers, five readable scrambled variants of examples/orders.cn (each is verified to format back to the canonical text), and every file in examples/ for the Examples menu. "Fuzzed variants" is the TOTAL constant from tests/fuzz.test.ts.
- Fonts are system stacks (no web font downloads), with one accent colour and light/dark themes following the OS through Fumadocs' theme provider. Landing-page code is highlighted by a small tokenizer, with no client JavaScript except the variant panel.
- Measured with Lighthouse 12 against the gzip-serving static export: performance 90–94, accessibility 96, best practices 100 on `/`, `/play` and the docs.

## 2026-11-22 — M5: docs choices
- One source for the agent reference: `content/docs/for-agents.mdx` is the page, and `/llms.txt` serves its body without frontmatter. It is plain Markdown (no MDX components), so the raw text reads well. It is about 2,800 tokens (the limit is 4,000).
- The docs test checks every ```canon block with the full checker. Fragments use ```text. A fence `name=x` can be prepended to a later fence `include=x` on the same page, so the reference's `restock_cost` sample can see `type Item`. The spec's bare `match` and pipeline samples are wrapped in small functions so they check.
- Docs line numbers in diagnostic examples count the `# expect:` line, because the output is generated from the exact block text.
- Shiki gets a small TextMate grammar for `canon` and uses the high-contrast GitHub themes for accessibility.
- The "Wasp lesson" on the Design notes page is not explained in SPEC.md. It is written as a hedged summary of Wasp's public account and needs the owner's review.

## 2026-11-22 — M5: fixes found while writing the docs
- A function used as a value (`map(xs, print)`) now counts its effects as used in the full checker. Before, E101 and E102 contradicted each other (the E101 patch caused an E102). The front-end `checkFront` keeps the oracle's behaviour.
- `xs.len()` reports "Canon has no methods; call len(xs, ...) instead" (still T002).
- `canon test` with several files keeps going past a file with diagnostics and reports it in the summary; `--json` now includes the tests' printed output as `stdout`.
- Left as is, and documented: test blocks are not effect-checked (tests may use any effect; time and rand are deterministic). `canon fmt` exits 0 when it reformats (it succeeded; `check` is the gate). A trailing comment on a code line is moved by fmt (C001), as in the oracle; P002 applies only inside record types and match.

## 2026-11-22 — M4: CLI output conventions
- `check` prints `path:line:col: error CODE: message` followed by the indented patch; `--json` prints the oracle-shaped `{ ok, canonical, diagnostics }` (an array of `{ path, ... }` when given several files).
- `fmt` prints canonical text; `--write` rewrites changed files silently; `--json` prints `{ path, changed, formatted }`. A parse error prints the diagnostic on stderr and exits 1.
- `run` refuses to run a file with any diagnostic (exit 1, diagnostics on stderr). A trap prints one JSON line on stderr; an Err from main prints `error: <message>` on stderr. `--json` captures the program's stdout into `{ ok, status, stdout, trap?, error? }`.
- `test` prints `PASS name` / `FAIL name` plus the trap JSON, then `N passed, M failed`, using the test host (clock at 0, rand seeded 42) over the Node host.
- Usage errors exit 2: unknown command, unknown or misplaced flag, unknown effect in `--deny`, missing or unreadable file. `run` takes exactly one file.
- The CLI is bundled by esbuild (from source, via the `source` export condition) into one `dist/index.js`, so the published `canon-lang` package has no workspace dependencies.

## 2026-11-22 — M3: code generation and runtime choices
- Output shape: `compileJs` emits the body of a function taking `$rt` and returning `{ main, tests, types, mainRet }`; `asModule` wraps it as an ES2022 module (`export default function load($rt)`). One artifact runs in Node, tests and a Web Worker without a module loader.
- Values: Int and Float are JS numbers; the checker's types pick the operation (Int `+ - *` are overflow-checked, Int `/` truncates). Lists and tuples are arrays, records and variants are `{ $t, field... }` objects, Unit is `undefined`, Map is a JS `Map` (keys are Int, Float or String, so value keys work).
- `to_string` gets a type descriptor at each call site so Float `1.0` prints as `1.0`. Formats: strings print bare at top level and quoted inside containers; `[1, 2]`, `(1, "a")`, `{"a": 1}`, `Point { x: 1 }`, `Some(3)`, `None`, `()` for Unit, `<fn>` for functions. Inside generic code (type unknown statically) a whole-number Float prints like an Int: a known limit of v0.
- Floats print like Python's repr (`1e+16`, `1e-05`, `0.30000000000000004`).
- Division or modulo by zero traps R004 for Float as well as Int (the spec does not distinguish).
- `pow` with a negative exponent truncates toward zero, like Int division (0^-n is R004). `to_int` of NaN or infinity is R003. `parse_int` returns None for out-of-range values. `random_int` with `hi <= lo` traps R005. `take`/`drop` clamp negative counts to 0. `split(s, "")` splits into code points; `str_len` counts code points; string `<` compares by code point.
- `try` is an exception (`$rt.Early`) caught by the enclosing function, which returns the Err. T007 already forbids `try` in lambdas, so the nearest catch is always the right function.
- Lambdas capture values, never variables: a lambda that reads a `var` gets a snapshot of it when created.
- The Canon stack trace lists frames innermost first: each frame is the function name and the position it was at (the call site for outer frames, the trap site for the innermost).
- A JS stack overflow (runaway recursion) is reported as trap code R000. It is not in the spec's list, but a host crash is worse.
- Hosts: `nodeHost` (real stdout, stdin, fs; net through a synchronous child-process fetch, because Canon is synchronous), `MemoryHost` (in-memory output, input and files), `browserHost` (MemoryHost denying fs and net), and `testHost(base)` (clock from 0 that advances only by `sleep`; mulberry32 seeded with 42; everything else delegates to the base host).

## 2026-11-22 — M2: type-checker gap fills
Decision, each with its reason (each picks the option with fewer ways to write a program):
- No unit literal. `Ok(())` is a parse error in the oracle, so the grammar cannot add one. A `Result[Unit, E]` comes from a call that returns one (`write_file`) or from a `Unit` function; the docs recommend returning a meaningful value instead.
- Map keys, `sort_by`/`group_by` keys and `map_from` keys must be Int, Float or String (the spec's `K`). JS maps then key by value with no hashing scheme.
- `+` is numeric only; strings join with `concat` (one construct per job).
- `try` inside a lambda is T007: a lambda body is one expression, and an early return from it would return from the lambda, not the function.
- `try` in a test block is T007, because tests return nothing.
- Module-path calls (`json.stringify`) are T002 ("module functions arrive in v1"); `use std.<name>` is accepted, and any other `use` is M001.
- User types may not redefine the built-ins (Option, Result, Error, the primitives), and user functions may not reuse a built-in name (no overloading). Both are T001.
- Duplicate declarations, a missing record field, a duplicate field, an out-of-range integer literal (beyond 2^53-1) and an unknown string escape are T001.
- A function used as a value (`map(xs, print)`) lends its effects to the enclosing function (E101).
- `for x in xs` walks a List only; walk a Map with `keys` or `values`.
- Locals may shadow outer locals; parameters are immutable (`set` on one is T006).
- Calling a local of function type (`f(x)` where `f: fn(Int) -> Int`) is allowed: it is a named call.

## 2026-11-22 — M2: type error test corpus conventions
Decision: `tests/types/fail` files name their expected code with a `# expect: CODE` comment, which the test reads from the first such line anywhere in the file, and the expected code must be the first diagnostic reported.
Reason: canonical form moves `use` lines above comments, so files that test modules (M001, T002 module calls) cannot carry the comment on line 1.

## 2026-11-22 — M2: the language reference's `Json` example
Decision: in the docs and /llms.txt, the reference sample's `Call(tool: String, input: Json)` becomes `input: String`.
Reason: `Json` is not a v0 type, and the spec requires every sample in the reference to pass `canon check`, which now includes type checking.

## 2026-11-22 — M1: source files are read with universal newlines
Decision: every tool reads `.cn` files through `readSource`, which turns `\r\n` and lone `\r` into `\n`.
Reason: the oracle opens files with Python's text mode, which does exactly this; without it a CRLF file gets a different C001 patch than the oracle prints.

## 2026-11-22 — M1: the front-end check keeps the oracle's built-in effect tables
Decision: `checkFront` uses the oracle's tables verbatim (no `random_int`, `drop`, `pow`, ...). The full checker (M2) uses the spec's standard library table.
Reason: front-end diagnostics must match the oracle byte for byte; with a larger table, a function that calls `to_float` and declares an unused effect would get E102 where the oracle stays silent.

## 2026-11-22 — M1: where the oracle crashes, Canon reports P001
Decision: a float literal that overflows (`1e999`) and a non-ASCII letter or digit outside strings and comments are P001 errors.
Reason: the oracle raises an uncaught Python exception in both cases (`repr(inf)` in the printer; `NAME_RE.match` returning None). A crash is not a diagnostic. No conformance file exercises these inputs, because the oracle has no output for them.

## 2026-11-22 — M1: the noisy printer never parenthesizes pattern literals
Decision: in fuzzing mode the printer prints `PLit` patterns without noise.
Reason: `(-1) => ...` parses as a one-item tuple pattern, so a noisy variant of `-1 => ...` is a different program. The Python fuzzer has the same latent bug but never hits it because its examples have no negative literal patterns. The canonical printer is unchanged.

## 2026-11-22 — M1: patches are byte-identical to the oracle's
Decision: port CPython's `difflib.SequenceMatcher` (including the autojunk heuristic) and `repr(float)` exactly, and cross-check them against a live python3 in `packages/compiler/test/pycompat.test.ts`.
Reason: the spec only requires codes, lines and columns to match, but agents apply patches mechanically, so the conformance test compares the whole diagnostic JSON, patches included.

## 2026-11-22 — Pin TypeScript 5.9, not the npm `latest` 7.x
Decision: use `typescript@~5.9` across the monorepo.
Reason: npm `latest` is now the native TypeScript 7 port; Next.js 16 and typescript-eslint still target 5.x.

## 2026-11-22 — Work on `main` in a fresh repository
Decision: `git init -b main` and commit each milestone on `main`.
Reason: the folder was not a git repository; the spec asks for one commit per milestone, and there is no remote yet (creating it is an owner step in DEPLOY.md).

## 2026-11-22 — Keep the zip and local Claude settings out of git
Decision: `.gitignore` excludes `canon-v0.zip` and `.claude/settings.local.json`.
Reason: the zip duplicates `reference/`, and local settings are per-machine.
