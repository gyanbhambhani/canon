# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

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
