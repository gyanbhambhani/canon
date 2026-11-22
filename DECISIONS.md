# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

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
