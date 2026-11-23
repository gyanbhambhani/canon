# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

## 2026-11-22 — v0.5 M6 and M7: example apps and docs
Decision: the full-stack addendum is its own page (for-agents-fullstack.mdx), served raw at /llms-fullstack.txt (1,265 tokens; the core reference is unchanged at 2,528). Agents read the core reference plus the addendum.
Reason: the spec keeps the core reference under 4,000 tokens and the addendum under 1,500. A separate page keeps both budgets independent.

Decision: in the docs, a multi-module example is a set of code blocks marked `project=P module=M`, checked together with checkProject. The docs say "a parity suite of random rules" without the count.
Reason: every Canon block in the docs must check, and modules only check as a project. The site's numbers test allows figures only from scripts/stats.ts.

Decision: the example apps (examples/todos, examples/shop) commit their generated code; a test rebuilds each in a temporary folder and diffs. The React frontends use Vite 7 with @vitejs/plugin-react 5 (6 needs Vite 8) and call the generated client through Vite's /api proxy. examples/shop's user-owned main.py replaces the payment host with a fake when CANON_FAKE_PAYMENTS=1, which the end-to-end test sets.
Reason: the spec's golden-files rule covers every program in examples/. Mocking at the dependency the generated code already uses keeps the outbound call's code path real.

Decision: runtime.table(name, model) and net.http(host) return the same dependency object for the same arguments, so `app.dependency_overrides[http("payments.example.com")]` replaces a host (or a table) in tests.
Reason: otherwise overriding meant digging the callable out of the Annotated alias's metadata, which mypy rejects and nobody would write by hand.

Decision: the end-to-end UI tests use their own Playwright config (pnpm e2e:examples; CI runs it after the smoke test), with a fresh SQLite database per run.
Reason: they need the Python backends and the Vite dev servers, which the static-site smoke test does not.

## 2026-11-22 — v0.5 M5: parity, drift and build
Decision: the parity suite evaluates each of 2,000 random portable expressions as an api fn's requires, on 3 random inputs, in the three places validation actually runs: the Canon JavaScript runtime (R001 means false), the generated Python route's require, and the generated TypeScript validator. Division and remainder use non-zero literal divisors, and Ints stay small.
Reason: that is the agreement the spec cares about, the server and the client deciding the same thing. Division by zero and overflow are traps on the server, and the client cannot trap. The suite found a real bug on its first run: Float `%` in a rule used math.fmod in api.py without importing math.

Decision: G001 covers every file with a Canon header in the output folders. canon build is all or nothing: an edited generated file, or a file Canon did not write at a path it would write, stops the whole build unless --force is given. A generated file that no module produces any more (a deleted module, or net.py once nothing declares a host) is removed. main.py is never touched once it exists.
Reason: partial builds would leave the frontend and backend out of step, which is the bug class v0.5 exists to remove.

Decision: canon dev runs uvicorn with $CANON_PYTHON (default python3) from the backend folder, rebuilds on every save of a .cn file under the source folder, and starts the server after the first successful build.
Reason: the CLI cannot know which Python has FastAPI installed. uvicorn's own --reload picks up the regenerated files.

## 2026-11-22 — v0.5 M3: the FastAPI backend
Decision: a one-module project generates logic.py (as in the spec's golden files); a project of several modules generates one Python module per Canon module (canon/billing/money.cn becomes canon_generated/billing/money.py) and no logic.py. models.py, api.py, store.py and runtime.py are shared. api.py imports a logic module under an alias (`users as users_logic`) only when a route parameter of the same name would hide it.
Reason: the spec says "plus one module per Canon module where a project has several", and keeping the Canon module structure keeps the one-to-one mapping readable.

Decision: the fixed Python files are real files in packages/compiler/py (runtime.py, store.py, net.py, accounts.py), checked by ruff and mypy --strict, and embedded into the compiler by `pnpm embed-py`; a test keeps them in sync. net.py (the host-bound HTTP client) and accounts.py (uuid and password hashing) are written only when a project uses them.
Reason: runtime.py had to stay under the spec's 250 lines. net.py and accounts.py are imported only by projects that need them.

Decision: store.py implements `Table` with SQLite (one SQL table per Canon table, rows as Pydantic JSON in insertion order, `$CANON_DATABASE`, default canon.db). A table whose row type's JSON schema changed is dropped and recreated. Every row is validated on insert and save.
Reason: the spec has no migrations in v0.5. Validation on write is what makes Canon's 53-bit Int hold: Python ints never overflow, and `model_copy` does not validate, so without it an overflowing update was saved and broke every later read. It now fails with 500 and nothing is saved.

Decision: intermediate Int arithmetic in generated Python is not range-checked; values are checked when they enter a record, a table or the wire (SafeInt), and the request fails with 500.
Reason: checking every operation would put a helper around every `+` and `*` (the spec's golden code has none). An overflow still never reaches storage or the client.

Decision: an api fn's requires is checked only in the route (spec), and the generator may rely on it as a precondition: `take(drop(xs, a), b)` becomes `rows[start : start + b]` only when a and b are provably non-negative from literals, len and count, and the requires' `name >= c` bounds; otherwise it slices with `max(n, 0)`.
Reason: Canon's take and drop clamp negative counts; Python slicing counts from the end. The spec's golden list_todos relies on its requires (page >= 1).

Decision: the Python line formatter (pyfmt.ts) reimplements the subset of ruff format the generator needs: right-hand splits trying trailers from the right, delimiter splits (comprehension, comma, ternary, logic, comparison, arithmetic priorities), optional parentheses for return, assignment, if, while, for and assert, delimiter-first inside brackets, a def's parameters before its return annotation, and parenthesized imports. Tests run ruff format --check, ruff check (with ruff 0.17's defaults, which include isort, comprehension, simplify and bugbear rules) and mypy --strict on every generated package.
Reason: the compiler has no dependencies and runs in the browser, so it cannot call ruff.

Decision: Option[T] is `T | None`, so a program with an Option of an Option (or of Unit) anywhere, even inferred (first of a List[Option[Int]]), is G002 for the Python target. Also G002: to_string of anything but Int, Float, String and Bool; read_line, read_file and write_file; a computed URL in a function that declares several hosts; match or try on the right of && or ||, or in a while condition.
Reason: each needs a design of its own; the error names the construct and the function, and the JavaScript runtime still runs the program.

Decision: a match on an Option becomes a Python match with a class pattern for Some (`case Todo() as t`), a guard (`case x if x is not None`) when the type is a type parameter; a match on a Bool becomes if/else; try (`?`) becomes `result = f()` / `if isinstance(result, Err): return result`; map and filter with a lambda become comprehensions, and `map_from(map(xs, |x| (k, v)))` a dict comprehension; a string built with + and to_string of an Int or String becomes an f-string.
Reason: the readability bar: these are the idioms a Python developer would write, and ruff's default rules (C4, SIM) flag several of the literal translations.

Decision: a Canon name that is a Python keyword or a builtin the generated code relies on (len, sorted, all, filter, ...) is renamed with a trailing underscore; a binding that would overwrite a visible one in Python's function scope (Canon scopes are per block) gets a numbered name (x_2).
Reason: Python scopes are per function, so Canon's block-scoped shadowing would otherwise change meaning.

## 2026-11-22 — v0.5 M4: the TypeScript client (built by a parallel agent, reviewed and integrated here)
Decision: types.ts holds only the wire types reachable from api fn signatures, in module dependency order then source order (with the built-in Error when reachable). A record with no fields is `Record<string, never>`.
Reason: logic-only types do not cross the wire; eslint rejects an empty interface.

Decision: a validator takes only the parameters its rule mentions, in parameter order. Errors in a method's Result are `E | ValidationError | TransportError`, with ValidationError only when the endpoint has a requires; a Unit return is `Result<null, ...>`.
Reason: unused parameters fail eslint and `--noUnusedParameters`.

Decision: createClient keeps the golden's `createClient(baseUrl: string)`; tests stub globalThis.fetch.
Reason: the golden file is the contract, and a fetch option can be added later without breaking callers.

Decision: TypeScript names that are reserved words, or that collide with names the generated code uses (baseUrl, invalid, request, the helpers), get a trailing `_`. String `<`, `<=`, `>`, `>=` use a compareStrings helper (code points, as in Canon and Python). Prettier's literal style is followed (quotes, `1e21`).
Reason: correctness and prettier --check.

Decision: a rule written `!(x)` generates `if (x)`, and a variable compared with a literal a second time in one rule is wrapped (`String(s)`) so TypeScript does not narrow it into an error.
Reason: eslint rejects `!!(x)`; TypeScript rejects a comparison it considers impossible after narrowing (TS2367).

Decision: in a validator, Int division by zero gives NaN, so the rule fails and the client returns ValidationError, while the server traps (500).
Reason: the validator must never throw. The parity suite (M5) excludes division by zero from the agreement it checks.

Decision: 400 and 422 responses whose body is `{"error": {kind, ...}}` become the typed error; any other status, a body that is not JSON, or a network failure becomes TransportError. A null Option query parameter is omitted; a String path parameter is encodeURIComponent'd.
Reason: methods never throw.

Decision: a String path parameter cannot be "", ".", "..", or contain "/". Starlette decodes %2F before routing, and URLs normalize dot segments, so such a request reaches no route; the client returns TransportError (404). Documented, not checked.
Reason: a limit of URLs and of the server, not of Canon; checking it would add a validation rule nobody wrote.

Decision: the trim whitespace set is exactly JavaScript's String.prototype.trim set (U+0009 to U+000D, U+0020, U+00A0, U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF), shared by runtime.ts and runtime.py. U+0085 (NEL) and U+001C to U+001F are not trimmed, although Python's strip would trim them.
Reason: one definition on both sides; the validator agreement test feeds both kinds of characters.

Decision: a multi-module project's generated headers say "from the Canon modules in canon/".
Reason: there is no single source file to name.

## 2026-11-22 — v0.5 M3/M4: golden files first
Decision: the worked example's six golden files are the spec's text plus, in each, the hash line the spec requires (`# canon-hash: sha256:<16 hex>`, over the file without that line). They are committed with `it.fails` tests, which become plain tests as each generator lands.
Reason: the owner's prompt asks for the golden files to be committed as failing tests first, and CLAUDE.md asks for commits only on green. Expected failures satisfy both. The spec's models.py had a placeholder hash, and the other files had none.

Decision: every package moves to 0.5.0 now.
Reason: generated headers say "Generated by Canon 0.5.0", and the golden files carry it. Bumping at release would churn every golden file and hash.

Decision: `pnpm pyenv` creates .venv from requirements-dev.txt (pinned FastAPI, Pydantic, uvicorn, httpx, ruff, mypy), and CI runs it. Tests that need Python fail, with that command in the message, when .venv is missing; they never skip.
Reason: M3's acceptance needs ruff, mypy --strict and FastAPI's TestClient. A skipped check would read as passed.

## 2026-11-22 — v0.5 M2: api fn, tables, effects with arguments, manifest
Decision: the std.store built-ins (get, scan, insert, save, delete, next_id, count) exist only in a program that declares or imports a table.
Reason: existing programs, including docs pages and benchmark tasks, define their own `save`, `count`, `get`, `insert` and `delete`, and a user function may not share a built-in's name (T001).

Decision: a table is a value of type `Table[Row, Key]`, named only as the first argument of a store built-in (new code A004). Its effect is `store(<that argument>)`.
Reason: the spec gives store built-ins the signature `(t, ...)`; restricting where a table may appear keeps every access visible to the effect checker, so `store(todos)` stays exact and per table.

Decision: Canon-Py spells a table `todos = table(Todo, key="id")`.
Reason: the spec gives every other v0.5 form a Canon-Py spelling but not tables; this reads as a Python module-level assignment and maps one-to-one onto `table todos: Todo key id`.

Decision: an `http_get`/`http_post` on a literal URL uses `net(<host>)`; on a computed URL it uses any declared net effect. When a function declares other hosts but not the literal one, that is E104 with a patch adding the host. E104 is not in `--fix`'s mechanical set. When a function declares no net effect at all, E101's patch adds `net(<host>)` for a literal URL and plain `net` for a computed one.
Reason: a host is a permission decision, so an agent should not widen a declared host list silently. The E101 patch was already automatic, and naming the host is the narrowest permission that works.

Decision: the run-time guard checks hosts per function. Codegen passes the calling function's declared hosts to `http_get`/`http_post`, which trap with R006 on any other host. The entry point's guard also checks `net(<host>)` and `store(<table>)`; tests may use every table.
Reason: the spec's guard must stop a computed URL to an undeclared host. Checking only the entry point's list would let an inner function reach any host its caller declared.

Decision: an effect's argument is written without spaces (`net(not a host)` is P001); in Canon-Py the quoted form drops whitespace, so `"store( todos )"` is `store(todos)`.
Reason: the brace parser joins tokens, and silently turning `not a host` into `notahost` would be wrong. The Canon-Py fuzzer showed that quoted effects need the lenient reading every other Canon-Py form gets.

Decision: validation rules (the manifest's `checks`, and later the 422 `rule`) are printed in canonical brace syntax whatever the source surface.
Reason: the rule is part of the wire contract between server and client, so it must not change when a project switches surface.

Decision: W010 appears only in `canon manifest`, not in `canon check`.
Reason: the spec says the manifest flags plain net. A warning in check would change the output of every existing program that uses `net`.

Decision: wire field and api parameter names may not be Python keywords or start with `model_` (A001). A variant may not have a field named `kind` (A001). `Option[Option[T]]` and `Option[Unit]` are not wire types.
Reason: field names are identical in Canon, JSON, Python and TypeScript, so a name Python cannot spell cannot be generated, and `model_` names collide with Pydantic's methods. The wire format uses `kind` for a variant's name. In JSON, null cannot tell the two Nones apart.

Decision: `hash_password` uses PBKDF2-HMAC-SHA256 in Django's format, implemented in pure JavaScript with 10,000 iterations in the Canon runtime. The generated Python will use hashlib with more iterations, and verification reads the count from the hash.
Reason: the runtime has no dependencies and must run in the browser, so it cannot call node:crypto. With a shared format, a hash made on either side verifies on the other.

Decision: `is_email` is `^[^@ \t\n\r\v\f]+@[^@ ...]+\.[^@ ...]+$`, with the whitespace class spelled out.
Reason: `\s` means different things in JavaScript and Python, and the rule must give the same answer in the server, the client and the parity suite.

Decision: the agent references (llms.txt and the Canon-Py reference) do not list the v0.5 built-ins and codes yet. The full-stack addendum (M7) will.
Reason: the core reference has a 4,000-token budget, and the spec puts full-stack material in a separate addendum of at most 1,500 tokens. The docs pages (diagnostics, standard library, CLI) document them now.

## 2026-11-22 — v0.5 M1: projects and modules
Decision: top-level names (types, variants, functions, tables) are unique across a project; a second definition is M004.
Reason: the spec's TypeScript output is one flat types.ts and one createClient object for the whole project, so two modules defining `Todo` or `create_todo` could not both be generated. It also lets codegen link a project by concatenating its modules, and keeps every name greppable across Canon, Python and TypeScript.

Decision: each module is checked as its own program, with the items it imports (and every type those items mention) appended as `extern` items. Checkers skip extern items and printers omit them.
Reason: the type and effect checkers stay single-program, and every diagnostic and patch stays in the module's own file (line numbers never mix files).

Decision: a type reached only through an import's signature is not visible; naming it is M003, with a patch that adds it to the import. Importing a sum type brings its variants; a variant cannot be imported by name (M003 names its type). A function or table of another module used without an import is reported as M003 (with the same patch) instead of T002.
Reason: "imports name what they take". The patch keeps the fix mechanical for agents.

Decision: `canon check` and `canon test` with no file work on the project around the current directory; a file inside a project's source folder is checked as part of its project. Project `--json` keeps the existing shape (one object for one file, otherwise a list with paths).
Reason: the agent loop is one command after each edit. Keeping the JSON shape means existing agent prompts still parse it.

Decision: `canon test` in a project compiles the linked project (all modules, dependency order) as one program. Trap line numbers then refer to the linked text, not to a module file.
Reason: the simplest correct linker for M1. Per-module source positions in traps are a follow-up if the experiment's agents need them.

Decision: Canon-Py rejects `from std import x` (as v0.4 did) and only project modules use `from m import A, B`.
Reason: v0.4's test requires it, and the standard library is never imported by name.

## 2026-11-22 — v0.5 is the full-stack version
Decision: v0.5 is now "full-stack" (docs/v0.5-fullstack.md). The earlier v0.5 plan in docs/roadmap-to-1.0.md ("write less": proven contracts, synthesis, a library of proven functions) moves after FS-1 and gets a version number when it is scheduled.
Reason: the owner's v0.5 build spec. Building v0.5 no longer waits for Experiments 1, 1b and 2; Experiments 1 and 1b must run before FS-1's main run, because they decide FS-1's Canon surface. Experiment 2 must still run before v0.7, whose proof point repeats it.

Decision: the undeclared-host error is E104, not E103 as the spec wrote.
Reason: E103 has meant "effect in a contract" since v0.3. Reusing it would give one code two meanings, and diagnostic codes are promised stable. The spec file is amended and marks the change.

Decision: the v0.5 milestones are listed in ROADMAP.md as "v0.5 M1" to "v0.5 M8", and commits are prefixed the same way.
Reason: ROADMAP.md already has M0 to M8 from the v0 build; bare names would be ambiguous.

## 2026-11-22 — v0.4.1: six follow-ups from the v0.4 review (every package moves to 0.4.1)
Decision: a `to_float` fix never wraps an integer division. T009's patch and T001's suggestion convert an Int `/` operand by operand (`to_float(a) / to_float(b)`), also through `+ - *` around it.
Reason: `to_float(sum(xs) / len(xs))` checks clean but still truncates, so a "fix" that an agent applies on trust (T009 is in `--fix`) silently changes the meaning of a mean.

Decision: with v0.3 defaults, the chained-comparison P001 says `use '&&'`; `--v0.2` keeps the oracle's `use 'and'`, and the conformance test substitutes only that hint when comparing v0.3 defaults to the oracle.
Reason: v0.3 prints `&&`, so the old hint named a spelling the formatter rewrites. The oracle is v0 and cannot know v0.3's operators; the v0.2 mode still matches it byte for byte.

Decision: text output lists T001 suggestions by label under `did you mean (patches in --json):`; the diffs stay JSON-only.
Reason: people reading text output never saw the suggestions. Printing every diff would bury the error, and agents are told to use `--json`.

Decision: `canon test` reports every contract-bearing function it does not fuzz as `SKIP` with a reason, counts skips in the summary and adds `skipped` to the JSON. Generic, effectful and parameterless functions now get a SKIP line instead of nothing, and a function whose `requires` rejected all 200 inputs is a SKIP, not `PASS (0 inputs)`.
Reason: a silent omission or a vacuous pass reads as "contracts checked" when nothing was checked.

Decision: the formatter breaks a too-long pipeline stage's arguments one per line (trailing comma), and the head the same way as any long value, but only when every resulting line fits; otherwise the line stays and is L001.
Reason: pipelines were the one common long line `fmt` could not break, so L001 had no mechanical answer there. Breaking only when it helps keeps the output stable and avoids reformatting that leaves L001 anyway.

Decision: a program compiled from Canon-Py prints values in Python spelling: `True`/`False`, `None` for Unit, records as `Item(sku="a")`. The compiled module carries `py: true`, and the runtime switches the display. Brace programs are unchanged. Canon-Py golden outputs that differ live in tests/py/run/*.out.
Reason: a Canon-Py program that writes `True` and prints `true` contradicts itself. Experiment 1b is unaffected, because its hidden tests run the reply after conversion to brace syntax.

## 2026-11-22 — v0.4: measurement, rulings, docs and release
Decision: the default syntax stays brace syntax; Experiment 1 decides whether Canon-Py becomes the default (it must be at least as correct as v0.3 syntax, at lower cost).
Reason: the owner's plan (docs/roadmap-to-1.0.md). Our own measurement supports waiting. On the benchmark's programs converted by fmt (same algorithm in both surfaces), Canon-Py is less surprising than brace syntax without documentation. With each surface's own agent reference, it is slightly *more* surprising, and both remain well above idiomatic typed Python (research/v0.4/surprisal/RESULTS.md). The v0.3 prototype's large advantage came mostly from Python's library and idioms, which v0.4 does not adopt (same AST, same standard library).

Decision: the surprisal comparison uses the benchmark's modal Canon programs converted mechanically to Canon-Py, not newly hand-written Canon-Py.
Reason: conversion holds the algorithm, helpers and names fixed, so the difference is the surface alone. It also means the Canon-Py texts are Canon-shaped (pipelines turned into nested calls, `to_string` turned into f-strings), and idiomatic Canon-Py written fresh might score better. We report this as a limitation rather than hand-write 50 programs that would mix style back in.

Decision: nats per character and per syntax-tree node are reported beside total nats and nats per token, as the owner asked.
- Canon's node count is its AST, which both surfaces share.
- Python's count uses `ast` nodes with a source position.
- TypeScript's count uses every node the compiler API visits, identifiers and keywords included, so its per-node figure is not comparable and is flagged as such.

Decision: contracts stay `@requires`/`@ensures` decorators against the model's preference for `assert` lines (-12.8 nats, 0/3 contexts, 1.5B).
Reason: a contract belongs to the signature. It is checked on every return, fuzzed by `canon test`, skipped by `--no-contracts`, and blamed with R001/R002. An `assert` before one `return` covers only that return, and reading a body's leading asserts as `requires` would silently turn existing asserts into fuzzed contracts.

Decision: the other rulings follow the 1.5B study, and the 7B study is reported beside it (research/v0.4/likelihood/REPORT.md).
- Records are a plain `class` (beat `@dataclass` by 1.5 nats); `@dataclass` is accepted and dropped.
- There is one blank line between definitions (beat PEP 8's two by 0.9).
- Sum types are one `type` line, a tie that we settled for semantic fidelity: variants are not types.
- Pipelines are dropped (a three-way tie; Python has none).
- Holes are `...` and lose their names.
- `/` keeps Canon's truncating meaning, and `//` and `**` are rejected.

Decision: the Canon-Py agent reference (for-agents-py.mdx, /llms-py.txt) mirrors the brace reference section by section, and a test keeps the section headings identical. Neither reference contains an output instruction. Experiment 1b's arm (research/v0.4/canon-py-arm.ts, outside research/exp1, which we did not edit) reuses the `canon` arm's prompt word for word except the language description: the signature and declarations shown in Canon-Py, and "def main or test functions" for "fn main or test blocks".
Reason: the owner asked that every arm request output the same way. All 60 hard tasks' reference solutions, converted to Canon-Py, pass that arm's check and hidden tests.

Decision: the docs keep brace syntax on every page except the new Canon-Py guide page and the Canon-Py agent reference. A ```canon fence marked `syntax=py` is checked as Canon-Py by the docs test. The Canon-Py guide page describes the measurements in words and links to docs/v0.4-design.md for figures.
Reason: the owner's plan. CLAUDE.md forbids hand-typed numbers on the website, and these figures are not in scripts/stats.ts.

Decision: every package moves to 0.4.0, and DEPLOY.md gains the publish step (the tarball must contain dist/runtime-standalone.js).
Reason: since 0.3.0 the npm version tracks the language version.

Decision: the corpora (examples/, tests/run, tests/types, the docs, research/exp1's references) stay in brace syntax. tests/py holds every example and tests/run program in Canon-Py, checked for identical output, test results and fmt round trips.
Reason: the owner's plan change (Canon-Py is opt-in). Tests changed because the language changed: three programs that pass an effectful function where a pure function type is expected now carry `# mode: v0.3` (see the fnEffects entry). The guide's section on the higher-order effect leak was rewritten to show T011, because v0.4 closes the leak.

Decision: `--watch` backs file-system events with a 300 ms stat poll.
Reason: a save made while the first run was still going was missed, because the watchers were registered only after that run (fixed: watchers start first). The poll is a second line of defence against dropped or coalesced events, and the text comparison makes a duplicate trigger harmless.

## 2026-11-22 — v0.4: canon build, --watch and --syntax
Decision: `canon build` writes a script that inlines the runtime. The CLI's build step bundles `packages/cli/src/standalone.ts` (runtime plus Node host) with esbuild into `dist/runtime-standalone.js`, an IIFE that defines `__canonRuntime`. The built file is that bundle, the compiled program as a string, and a call to `runMain` with the Node host. `--deny`, `--no-contracts` and `--no-capability-guard` are baked in only when given at build time. Trap and Err output is written exactly as `canon run` writes it.
Reason: the brief asks for a file that runs with plain `node` and no installed dependencies. The bundle is read from the CLI's own dist directory at build time, so the CLI stays one package and the runtime is not duplicated in its source.

Decision: the script form is CommonJS-compatible (an IIFE that uses `require` for Node built-ins). `--module` emits an ES module that defines `require` with `createRequire`, loads the program and exports `fns` (and `default`). Without `-o`, the default output is `FILE.js`, or `FILE.mjs` with `--module`.
Reason: a `.js` file runs as CommonJS under plain `node` unless a `package.json` above it says `"type": "module"`. A module needs `.mjs` to import as ESM anywhere. In a `"type": "module"` package, name a built script `.cjs` with `-o`.

Decision: `--watch` watches the file's directory and filters events by file name, then debounces by 100 ms and reruns only when the file's text changed since the last run. After each run it prints one status line, `[HH:MM:SS] CMD FILE: summary`, and it clears the screen first only when stdout is a terminal. check, test and build rerun in-process. run starts a child process (`canon run` with the same flags) and kills the previous child on each new save. SIGINT closes the watcher, kills any child, and exits with 130.
Reason:
- Editors often replace a file instead of writing it in place, and watching the directory survives that.
- Comparing text both ignores duplicate events and makes `check --watch --fix --write` immune to its own writes: the watcher records the text it just wrote as already seen.
- Status lines stay greppable when output is piped, which is how the tests read them.
- 130 is the conventional exit status after Ctrl-C.

Decision: `--syntax brace|py` picks the surface; `--v0.3` selects the v0.3 language (no effects on function types, brace printer); `--no-fn-effects` turns off v0.4's one language switch. A Canon-Py file checked without `--syntax py` gets C001 with a message saying to pass `--syntax py` or apply the patch to convert it.
Reason: the owner's plan keeps brace syntax the default everywhere, including for files written in Canon-Py, so design law 1 is checked against the selected surface. The message turns a confusing C001 into one instruction.

## 2026-11-22 — v0.4: effects on function types (fnEffects)
Decision: function types carry effects: `fn(String) -> Unit effects: io` in brace syntax and `Callable[[str], None, io]` in Canon-Py. Calling a function value performs its type's effects, so the caller's signature must declare them (E101, with the usual patch). An effectful function used where the expected function type does not allow its effects is a new error, T011. The change is behind the `fnEffects` switch (`--no-fn-effects`; off in `--v0.3` and `--v0.2`).
Reason: the owner asked for the per-function guarantee. Before this, `fn apply(f: fn(String) -> Unit, s: String)` was pure in its signature yet performed io when given `print`, so the guarantee held only for the whole program. Effect types make every signature exact. We chose them over the interim rule (no effectful function values at all) because the type checker already infers function types, so the check is local: a function value's effects come from its declaration, a lambda's from the calls in its body, and a parameter's or field's from its annotation.

Decision: the brace spelling puts the clause after the return type on the same line (`fn(A) -> B effects: io, net`). A clause on its own line still belongs to the enclosing function. In a parameter list, an effect name followed by `:` starts the next parameter.
Reason: the v0.3 likelihood study preferred the trailing clause under the 1.5B model (+1.27 nats, 2/3 contexts), and it is the spelling of the function-level clause. The 7B model preferred a prefix (`-> io B`), but one spelling for both clauses keeps the reference short. For Canon-Py, research/v0.4/likelihood scored four spellings, and `Callable[[A], B, io]` won (+2.5 nats, 2/3).

Decision: T011 carries no patch.
Reason: the fix is a choice. The agent can widen the receiving function type (which changes that function's contract and its callers) or stop passing the effectful function. Neither restates what the program already means, so neither is mechanical.

Decision: the standard library's higher-order functions (map, filter, fold, sort_by, ...) take pure functions, so `map(xs, print)` is now T011.
Reason: their signatures are pure. Letting them accept effects would need effect polymorphism, and a `for` loop is the one way to perform an effect per item. Lambdas are still checked conservatively: a function that names an effectful function anywhere, inside lambdas too, declares that effect, as in v0.3.

Tests changed because the language changed: `tests/types/pass/effect_fn_value.cn` and the red-team programs `tests/effects/higher_order_caller_declares.cn` and `stored_hook_origin_declares.cn` were legal in v0.3 and are exactly the leak v0.4 closes. They now carry a `# mode: v0.3` line and are checked in that mode (the harnesses read the line). `tests/types/fail/t011_map_print.cn` and ten `tests/effects/fx_*.cn` programs cover v0.4:
- parameters, record fields, lambdas, generics, nested passing, lists and return values are each rejected (T011);
- calling an effectful function value without declaring the effect is E101;
- a fully declared program runs.

Each red-team test also checks that with `--no-fn-effects` the leak is invisible again.

## 2026-11-22 — v0.4: Canon-Py, an opt-in surface
Decision: Canon-Py ships behind the `py` switch (`--syntax py`; compiler `features: { py: true }` or `V04_PY`). Brace syntax stays the default until Experiment 1 compares the two syntaxes on the hard tasks; Canon-Py becomes the default only if it is at least as correct as v0.3 syntax at lower cost.
Reason: the owner's plan (docs/roadmap-to-1.0.md on main). The v0.4 evidence is a base-model proxy, not agent behaviour.

Decision: the parser reads both surfaces in every mode, detecting Canon-Py per file. A file is Canon-Py when a top-level line starts with `def `, `class `, `@` or `import `. fmt migrates in either direction: `canon fmt --syntax py --write` produces Canon-Py, and plain `canon fmt --write` produces braces.
Reason: no brace-syntax file in the repository has such a line, so detection never changes how an existing file parses (the conformance corpus is unchanged in every mode). Files with neither marker (comments, one-line sum types) mean the same in both surfaces.

Decision: Canon-Py parses to the same AST, and the type checker, code generator and runtime are shared.
- A Python form with no Canon meaning is a parse error that names the Canon form. These are methods, list indexing, `continue`, exceptions, comprehensions, keyword arguments to functions, `//`, `**`, multi-statement case bodies, guards and or-patterns.
- Type names and the wording of syntax-specific messages follow the active surface.
Reason: the owner's constraint (same AST, shared back end). Every ruling and its evidence is in docs/v0.4-design.md.

Decision: Canon-Py infers mutability. `x = e` binds when x is not visible and assigns otherwise; scoping stays Canon's block scoping; assigning to a parameter rebinds a local copy (a hidden `var p = p`).
- When printing any program as Canon-Py, fmt drops `let x = x`, makes an unassigned `var` immutable and an assigned `let` mutable, and renames a shadowing `let` to `name_2`.
Reason: the study preferred bare bindings by 16.9 nats over `let`/`var` and `Final`, and direct parameter updates by 7.5 nats. Canon values are immutable, so a parameter update can never reach the caller. Shadowing has no Canon-Py spelling, because a second `x = ...` is an assignment.

Decision: Canon-Py wraps long statements recursively, Black-style: the outermost bracket first, then any item that is still too long, and a lambda wraps its body.
Reason: Canon-Py has no pipelines, so a v0.3 pipeline becomes nested calls that are often longer than 100 characters. Wrapping only the outermost bracket (v0.3's rule) would leave L001 on migrated files, and migration must be mechanical.

## 2026-11-22 — Release 0.3.0: the npm version tracks the language version
Decision: every package moves from 0.1.1 to 0.3.0 together, so `canon-lang@0.3.0` is language v0.3 (0.1.x was v0 and v0.2). `tests/release.test.ts` and the `--version` check in `tests/cli.test.ts` are updated to 0.3.0 as part of the bump.
Reason: a reader seeing `canon-lang 0.2.0` running language v0.3 would be misled; matching numbers make the docs, the changelog and the package agree.

## 2026-11-22 — Language v0.3: what the evidence decided
Decision: the v0.3 objective is total surprisal of a correct program under local Qwen2.5-Coder 1.5B and 7B (research/v0.3/surprisal), with tokens per program and nats per token reported beside it. It is used as a proxy for "the language an agent has to think least about", not as a measure of agent accuracy.
Reason: the owner's brief; and in the v0.2 benchmark about 80% of Claude's Canon output was reasoning, not code (research/v0.3/tokens), so length alone cannot be the objective.

Decision: Canon-Py (Canon's rules in a strict subset of typed Python syntax) is recommended as the v0.4 direction, staged behind Experiment D of research/v0.3/PREREGISTRATION-draft.md, and not built in v0.3.
Reason: it is the largest measured effect (14 to 17 nats per program lower than Canon even with each language's documentation, within 2 nats of typed Python), but the measurement is a base-model proxy on hand-written programs, and building it means a new front end, semantic choices (unbounded int, `/`) and a migration. The brief allows staging when a full redesign cannot be made solid.

Decision: rejected `fn f() -> T = e`, implicit final return, dropping `let`, indentation in Canon's syntax, `continue`, and a `find` library function.
Reason: each terse edit raises surprisal (bare: +0.7 to +5 nats per program; all together +5 to +9) and the v0.3 likelihood study prefers the v0.2 form; `continue` loses to the guard form in every context; `find` would be a second way to do what `return` from a loop does.

Decision: adopted `&&`/`||`/`!` although its surprisal gain is small (about -0.2 nats per program on average, -1.4 to -2 per program it touches, Claude's programs only).
Reason: two likelihood studies prefer symbols (v0: 0.39x and 0.83x for words, 3/3 contexts; v0.3: 0.15x and 0.41x), it is token-neutral (research/v0.3/tokens/V03_DELTA.md), fmt migrates it, and it is the spelling of every language the models know. Against the model's preference: none.

Decision: kept the effects clause on its own line, against a weak model preference for inline placement (0.2 to 1.7 nats) and a strong one for a short `with io` suffix.
Reason: the `with` margin is mostly length, the inline margin is within noise on 7B, and moving the clause would rewrite every effectful function in every corpus for little gain; Canon-Py's decorator is the place to revisit it.

Decision: kept braces, `fn`, `let` and explicit `return`.
Reason: the v0.3 likelihood study prefers each within Canon's syntax (braces 9.3x and 1.2x, `fn` 3.7x and 36x, `let` 90x and 2x, block-with-return over `= e` 2.7x and 15x), and the surprisal study finds each alternative raises surprisal.

## 2026-11-22 — Language v0.3: implementation
Decision: v0.3 ships eight changes, each behind a switch in `packages/compiler/src/features.ts` (language: `wrap`, `break`, `destructure`, `symbols`, `sealedEffects`, `suggestions`) or in the CLI/runtime (`--fix`, `--no-capability-guard`, `--no-contract-fuzz`). With every switch off (`--v0.2`, or `features: V02`) the compiler is v0.2 byte for byte on the conformance corpus.
Reason: the owner's brief requires each v0.3 feature to be ablatable, so a future experiment can attribute any effect to one change. docs/v0.3-proposal.md has the evidence and ranking for each change.

Decision: the switches are a module-level setting scoped by `withFeatures` for the length of one `check`/`fmt`/`compileJs` call, not a parameter threaded through the parser, printer and checker.
Reason: the compiler is synchronous, so the scope nests safely, and it keeps every internal signature (and the oracle-shaped front end) unchanged.

Decision: `!` is a unary operator at precedence 7 (with `-` and `try`), not a respelling of v0.2's `not` at level 3. fmt therefore rewrites `not a == b` to `!(a == b)`.
Reason: every language models know (TypeScript, Rust, C, Java) binds `!` tightly; keeping `not`'s loose binding under the `!` spelling would make `!a == b` mean something different from what a model expects.

Decision: `||` at the start of an expression is still a lambda with no parameters; between operands it is "or".
Reason: the lexer now reads `||` as one token, and zero-parameter lambdas (`|| 1`) are legal; Rust resolves the same ambiguity the same way.

Decision: `break` is a contextual keyword: a statement only when it is alone on its line. It stays usable as a name.
Reason: reserving it would break any v0.2 program that uses `break` as a name, and a bare name on its own line was already an error (P004), so the statement form is unambiguous.

Decision: no `continue`.
Reason: the v0.3 likelihood study (research/likelihood/REPORT-v0.3.md) found the guard form (`if !cond { ... }`) preferred over `continue` in every context by both models; adding `continue` would add a second way to skip an iteration.

Decision: `for (a, b) in xs` takes two or more plain names (or `_`), not nested patterns.
Reason: it covers `enumerate`, `zip` and map pairs, which is where the benchmark's `pair.0`/`pair.1` variants came from; nested patterns belong to `match`.

Decision: line wrapping breaks only the outermost list, tuple (2+ items), record or call (not pipeline) bracket of a statement whose text has a line over 100 characters, one item per line with a trailing comma. Anything else stays L001.
Reason: it is the form models already wrote in the benchmark's L001 drafts (validate_user), it depends only on the tree (so one text per program still holds), and a single rule is easy to state in the reference.

Decision: in tests, only `fs` and `net` are declared; `io`, `time` and `rand` are not (declaring them is E102).
Reason: the test host virtualizes time and rand and captures nothing real for io, so they are not side effects on the world; the likelihood study found an effects clause on a test 20 to 110 times less likely than none, so the common case keeps no clause, and only the real effects need one.

Decision: `requires` and `ensures` must be pure (new code E103), under the `sealedEffects` switch.
Reason: the red-team suite (tests/effects) found that a contract could call `now()` or any effectful function without any signature showing it; contracts are also skipped by `--no-contracts`, so an effect in one would depend on a flag.

Decision: the runtime capability guard is on by default. `canon run` allows exactly main's declared effects; each test allows io, time, rand and its declared fs/net; contract fuzzing allows none.
Reason: the checker already guarantees this, so the guard never fires on a checked program; it makes the "you can know what it can do before running it" claim hold even if the checker has a bug (tests/effects.test.ts forges a module to show it).

Decision: `fix()` applies C001, E101, E102 and T009 patches, one at a time with a re-check after each, up to 32 rounds; never T004.
Reason: those four patches only restate what the program already means (layout, the exact effect list, an explicit to_float). T004's patch inserts holes, which are questions for the agent.

Decision: contract fuzzing tries 200 inputs per function from a mulberry32 generator seeded with 2026, biased to small values (Ints mostly in -50..50, strings of up to 6 characters from a small alphabet, lists up to 5 items). Inputs whose own `requires` fails at the top frame are discarded; every other trap, including R003 and R004, is a counterexample. Only pure, non-generic functions that declare a contract are fuzzed.
Reason: a counterexample must be something the function's own contract admits; small values keep counterexamples readable; limiting fuzzing to functions with a contract means the author asked for the check.

Decision: suggestions (T001 `data.suggestions`) cover to_string, to_float, to_int, `unwrap_or(e, ?)`, `Some(e)`, `Ok(e)` and `[e]`, and for `String + Int` the non-String side. They are not applied by `--fix`.
Reason: those conversions are the ones the reference tells agents to use; each is a choice between meanings, not a mechanical fix.

Decision: the conformance test checks the v0.2 rules with every switch off (exactly as before), and adds a v0.3 pass: with the defaults, a file whose oracle output uses `and`, `or` or `not` may differ from the oracle only on those lines (and v0.3 fmt must equal v0.3 fmt of the oracle's output); every other file must match the oracle byte for byte.
Reason: the oracle stays the spec for everything v0.3 does not change, as in v0.2.

Decision: `scripts/site-data/likelihood.ts` decides what "v0.2 adopted" with the v0.3 switches off.
Reason: /research reports the v0.2 study; with the v0.3 defaults the formatter would also mark `&&` as adopted, which is true of v0.3, not v0.2.

Tests changed because the language changed (not to make them pass): `tests/types/pass/comparisons.cn`, `tests/types/pass/equality_structural.cn`, `tests/types/fail/t001_and_operand.cn`, `tests/run/bools.cn` and `tests/run/rand_int.cn` were migrated with `canon fmt --write`, and the docs' code blocks with the same formatter (only blocks that were v0.2-canonical).

## 2026-11-22 — /research rewritten as a research post
Decision: /research leads with the result (H1), then four findings, one chart, method, what we learned, what's next, data links and a collapsed appendix, using the owner's brief verbatim. Criteria codes, commit hashes and confidence intervals appear only in the appendix; a Playwright test enforces that on the rendered page.
- The brief's REDESIGN.md is not in the repository, so its section 6 copy rules could not be checked; the page follows the design tokens in global.css and the redesign entry below.
- Statements the copy makes about the data ("Every Canon program worked", "went up for one model and down for the other", "v0.2 adopted all three") are pinned to the data by apps/web/test/research-copy.test.ts, so a future run that changes them fails until the copy is updated.
- The total run count is computed on the page from the two studies (not added to the generated display strings), because "4,000" also appears in the docs as the reference's token budget, and the hard-coded-number test would flag it there.
- The chart is one image to assistive technology (role="img" with a summary aria-label), which keeps its tick labels out of the page's text; the x axis is fixed at 0 to 6.
- The landing page's benchmark table gains a cost row, marked "✗ Not yet" with the cost multiple, under the consistency row (which is marked the same way).

## 2026-11-22 — Website redesign: version 0.1.1, charts, and tests
Decision: every package moves to 0.1.1 together (the brief bumps the CLI; DEPLOY.md bumps all packages together). `tests/release.test.ts` and the `--version` test now expect 0.1.1; the check is unchanged, only the expected value.
Reason: the npm listing gains its description, repository, homepage, bugs and keywords fields, and the `exports` map drops the unshipped `source` condition (nothing imported `canon-lang` through it).

Decision: the site no longer serves the report scripts' PNG-style SVG charts (`apps/web/public/research/*`), and `report.ts`, `report-v02.ts` and `report.py` stop copying them into the site. The charts stay next to their reports in `research/`; /research draws its own chart from the raw runs in the site's colors.
Reason: the brief requires no Tailwind default blue anywhere on the site, and the copied charts used it. Their numbers also duplicated what /research now renders from data.

Decision: README.md has two generated blocks (the hero transcript and the benchmark table) that `scripts/stats.ts --write` refreshes; `tests/readme.test.ts` fails when they are stale. "How it is checked" moved to CONTRIBUTING.md without its counts.
Reason: the brief puts the badge and benchmark text under the same no-hand-typed-numbers rule as the site.

## 2026-11-22 — Docs restructure
Decision: the docs follow the brief's four-part sidebar (Get started, Learn the language, Reference, Project). Existing slugs stay; only titles change. Two pages are new (`agents`, `roadmap`), and Research is an external link entry in meta.json.
Reason: external links point at the existing slugs.

Decision: the M8 benchmark and likelihood tables, charts and figures leave Design notes. The page keeps the thesis as three hypotheses, the design laws, the Wasp lesson and related work, plus one paragraph that says which claims are supported (understood from the reference, correct, turns to working code) and which are not (convergence, v0.2 improving it, cost), that runtime speed is not tested, and links to /research. Open questions and the future-work list moved to the new Roadmap page. The "native dialect" claims ("Canon does not ask a model to learn anything new") are gone from every page.
Reason: the likelihood study contradicted those claims, and the brief's rule is that a claim appears as fact only when a passing test or a SUPPORTED verdict backs it.

Decision: design law 7 keeps the 4,000-token budget as a number.
Reason: it is a rule enforced by `docs.test.ts`, not a measured figure, and it does not appear in site.json; the reference's actual size is never typed.

Decision: Formatting rules (canonical-form.mdx) replaces one before/after pair per rule with a single table of rules plus four checked before/after examples (clauses, the call-parenthesis line rule, line length, v0 spellings).
Reason: the page had to fit in 900 words; the table still lists every rule the old page described.

Decision: the docs.test.ts minimum-length check stays as it was (index > 800 characters, others > 600).
Reason: the new 250-word index is about 1,350 characters of body, so it passes without weakening the check.

Decision: the Quickstart applies the compiler's patch with `canon check --json FILE | jq -r '.diagnostics[0].fix.diff' | patch -p1`.
Reason: the CLI has no `--fix` flag; this shows the exact JSON-to-patch path an agent uses, and it was run against the CLI to confirm the output shown.

Decision: a float literal `9.0` in the Matching page became `4.5`.
Reason: `9.0` equals a generated figure in site.json, so the numbers test, which now scans content/docs, flagged it.

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
