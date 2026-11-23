# Roadmap

Copied from the Milestones section of SPEC.md. Tick boxes as they pass.

## M0: Scaffold

Set up the monorepo exactly as in Architecture, with CI running from the first commit.

- [x] `pnpm install && pnpm test` passes on a clean clone
- [x] .github/workflows/ci.yml runs lint, type-check, all tests and the web build on every push
- [x] `pnpm oracle` regenerates tests/conformance expectations from reference/canon.py
- [x] ROADMAP.md, DECISIONS.md and CLAUDE.md exist

## M1: Front end in TypeScript

Port the lexer, parser, normalizer, printer and checker (naming, effects, holes) from reference/canon.py.

- [x] The conformance corpus holds every reference example plus at least 60 new cases covering each grammar rule and each diagnostic code
- [x] fmt output is byte-identical to the oracle on every conformance file
- [x] Diagnostic codes, lines and columns match the oracle on every conformance file
- [x] Ported fuzzers (random whitespace plus the noisy printer) collapse 5,000 variants to their canonical texts with zero failures
- [x] fmt is idempotent on every fuzzed variant

## M2: Type checker

Implement the type rules in Runtime semantics, including inference for locals and lambdas, exhaustive match, and holes everywhere.

- [x] At least 40 programs in tests/types/pass type-check
- [x] At least 30 programs in tests/types/fail fail with their expected code, covering T001 to T009 and M001
- [x] The T004 patch applies cleanly and the patched file then reports only H001 holes
- [x] The T009 patch applies cleanly and the patched file passes
- [x] H001 reports an expected type for holes in let bindings, arguments, returns and match arms

## M3: Code generation and runtime

Compile checked programs to JavaScript and implement the standard library, contracts, traps and effect hosts.

- [x] At least 25 programs in tests/run print their expected output, including hello, fizzbuzz, word count, orders ranking with a pipeline, Result with try, and a match over a sum type
- [x] Trap tests cover R001 to R006, each printing the JSON trap with the right code and line
- [x] `--deny net` makes http_get trap with R006
- [x] Under the test host, now() and random() give the same values on every run
- [x] Every standard library function in the table has at least one test

## M4: CLI

Ship the canon command.

- [x] `canon check`, `canon fmt [--write]`, `canon run [--deny ...] [--no-contracts]` and `canon test` work, each with `--json` output
- [x] Exit codes: 0 success, 1 diagnostics or failed tests or traps, 2 usage error
- [x] `node packages/cli/dist/index.js run examples/hello.cn` prints `hello, canon` from a clean clone after `pnpm build`
- [x] CLI integration tests cover every command and flag

## M5: Docs site

Build the docs at /docs with the page tree in the Docs site section.

- [x] Every page in the Docs site section exists with real content drawn from this spec
- [x] A test extracts every Canon code block from the docs and runs check on it; examples marked as failing must fail with their stated code
- [x] /llms.txt serves the agent reference as plain text, and a test keeps it under 4,000 tokens (counted as characters divided by 3.5)
- [x] `pnpm --filter web build` passes

## M6: Landing page and playground

Build / and /play as described in the Landing page section.

- [x] The playground formats, checks and runs hello.cn entirely in the browser, with execution in a Web Worker and a 2-second time limit
- [x] Diagnostics with a patch show an Apply button that rewrites the editor contents
- [x] The landing page's numbers come from scripts/stats.ts at build time
- [x] The GitHub button reads NEXT_PUBLIC_GITHUB_URL and is hidden when it is unset
- [x] A Playwright smoke test loads /, /docs and /play and runs one program

## M7: Release readiness

- [x] README.md with the one-line pitch, a code sample, quickstart and links
- [x] LICENSE (MIT), CONTRIBUTING.md, and version 0.1.0 in every package
- [x] DEPLOY.md lists, in order: create the GitHub repo, push, set NEXT_PUBLIC_GITHUB_URL, import apps/web into Vercel, publish canon-lang to npm
- [x] CI is green on the final commit

## Website redesign (2026-11-22 brief)

- [x] Design system: Geist, color tokens in both themes, wordmark, nav with theme toggle, footer
- [x] Landing page: hero with the generated terminal, features, benchmark, syntax, call to action
- [x] /research renders verdicts, chart, findings, likelihood table and costs from data
- [x] Docs restructured (What is Canon, Quickstart, Use Canon with your agent, shorter guide, Reference, Project)
- [x] Playground opens on a mistake with Apply fix; Break it; tabs for Problems and Output
- [x] README, npm metadata, CONTRIBUTING and DEPLOY updated

## M8 (stretch): Evidence

Only after M7, and only when the owner provides model access.

- [x] research/likelihood/: score equivalent spellings of 10 to 15 constructs with a small open-weights model and report which form wins and by how much
- [x] research/benchmark/: 40 tasks run 10 times each in Canon and in TypeScript, reporting distinct programs per task, first-pass check rate and fix rounds
- [x] One chart per study, embedded in the docs Design notes page


# v0.5: full-stack

Copied from the Milestones section of docs/v0.5-fullstack.md. M3 and M4 may run in parallel after M2. After M3 and M4, stop for the owner's approval of the generated code before M6.

## v0.5 M1: Projects and modules

- [x] canon.toml is read; canon check and canon test work across a multi-file project.
- [x] Explicit named imports work in both surfaces; M002 (cycle) and M003 (unknown name) each have tests.
- [x] Canonical form sorts imports; fuzzed import orders collapse to one text.
- [x] Every existing single-file test still passes unchanged.

## v0.5 M2: API functions, tables and effects with arguments

- [x] api fn with route: parses in both surfaces and type-checks; A001 to A003 each have at least three failing-program tests.
- [x] Tables and the std.store built-ins work in the JavaScript runtime, in memory; R007 has a test.
- [x] store(table) and net(host) effects follow the exact-effects rules; E104 and W010 have tests; the capability guard traps a computed URL to an undeclared host with R006.
- [x] canon manifest prints the worked example's manifest exactly, in text and JSON.
- [x] canon test can call api fns directly, with tables empty for each test.

## v0.5 M3: Python backend

- [x] The worked example generates the golden Python files, which pass ruff check, ruff format --check and mypy --strict.
- [x] HTTP tests (FastAPI's TestClient) cover 200, 400, 422 and 500 for every endpoint shape: body, path parameter, query parameters, and Result and plain returns. Error bodies are `{"error": ...}`.
- [x] Tables persist in SQLite across requests and start empty in tests.
- [x] Each generated logic function receives only the tables and hosts its Canon effects name.

## v0.5 M4: TypeScript client

- [x] The worked example generates the golden TypeScript files, which pass tsc --strict, prettier --check and eslint.
- [x] Client methods return Result and never throw, including on network failure and 500.
- [x] Validators reject exactly what the server's require rejects, checked on 1,000 random inputs per endpoint.
- [x] An integration test runs the generated client in Node against the generated backend for every endpoint.

## v0.5 M5: Parity, drift and build

- [x] The semantic parity suite (2,000 random portable expressions, three evaluators) passes in CI.
- [x] Hand-editing a generated file makes canon check report G001 and makes canon build refuse without `--force`.
- [x] canon build and canon dev work from canon.toml; main.py is created once and never overwritten.

## v0.5 M6: Example apps

- [ ] examples/todos/: the worked example, with a small React UI that uses the generated client.
- [ ] examples/shop/: users, products and orders across three modules, with signup, pagination and an outbound call to one declared host (mocked in tests).
- [ ] Playwright tests drive both UIs end to end.

## v0.5 M7: Agent reference and docs

- [ ] A full-stack addendum to the agent reference, at most 1,500 tokens, served at /llms-fullstack.txt. The core reference stays under 4,000 tokens.
- [ ] Docs pages: Full-stack quickstart, API functions, Tables, Generated code, canon.toml and the new commands. Every Canon code block passes canon check.
- [ ] The landing page's claims stay limited to what the tests show; nothing about agent results until FS-1 reports.

## v0.5 M8: Experiment FS-1, ready to run

- [ ] The three starter apps and the task suite are built as described in Experiment FS-1, and every task's reference solution passes its hidden tests in all three arms.
- [ ] A 10-task pilot has run in every arm with every model.
- [ ] The power analysis and pre-registration are committed before the main run starts.


## Progress log

### M0 (done)
- pnpm monorepo: packages/compiler, runtime, cli (bundled by esbuild into dist/index.js), apps/web (Next 16, Tailwind 4).
- Packages export a `source` condition (src/*.ts) that vitest and tsc use; builds resolve to dist.
- `pnpm oracle` copies reference/examples into tests/conformance as ref_*.cn and regenerates .diag.json/.fmt.cn by running python3 reference/canon.py with repo-relative paths.
- CI runs the oracle self-test, checks the conformance expectations are current, then build, lint, typecheck, test, web build.

### M1 (done)
- Front end ported to packages/compiler/src (lexer, parser, normalize, printer, check, difflib, py helpers). `checkFront` is the oracle's `check`; `fmt` is the oracle's `fmt`.
- The conformance test compares the whole JSON (messages and patches too), not just code/line/col. 124 new cases: g_* grammar, m_* messy inputs, d_* diagnostics.
- Tricky: Python's repr(float), splitlines, repr(str), universal newlines and difflib all had to be reproduced exactly; pycompat.test.ts checks them against python3.
- Next session: M2's type checker should be a separate pass (`checkTypes`) layered on checkFront; keep checkFront oracle-exact.

### M2 (done)
- packages/compiler/src/types.ts: unification with occurs check; `K` key variables; rigid type params inside generic fns; bidirectional lambdas (non-lambda args are checked first); Maranget witnesses for T004 (each missing arm is added with a `?` hole); T009 patch wraps the Int side in to_float.
- Standard library signatures live in prelude.ts as Canon source parsed by the compiler; the full effect table derives from it.
- `check()` = front end + M001 + exact effects (full stdlib) + types + typed H001. `checkFront()` stays oracle-exact. `analyze()` also returns the normalized program and TypeInfo (expr types, call kinds, lambda unpacking) for codegen.
- Next: codegen must read `info.types` to tell Int from Float (`/` truncates, overflow checks, to_string prints 1.0).

### M3 (done)
- compiler/src/codegen.ts generates JS from the normalized program plus TypeInfo; runtime/src/exec.ts is `$rt` (stdlib, traps, stack, contracts); runtime/src/node.ts is the Node host, exported as `@canon/runtime/node` so browser bundles never import node APIs.
- examples/ has hello, fizzbuzz, word_count, orders, result_try (each with test blocks); their expected output is tests/run/example_*.out. tests/run has 27 more programs; `.in` files feed read_line.
- Tricky: the HTTP test needs its server in a separate process (the host's synchronous fetch blocks the event loop). Test sources must be canonical, effect-exact Canon, or `compileOrThrow` refuses them.
- Next (M4): the CLI wraps check/fmt/run/test around compileJs plus runMain/runTests with nodeHost (and testHost for `canon test`).

### M4 (done)
- packages/cli/src/main.ts holds `main(argv, io)`; index.ts is the process entry. Tests spawn the built dist (`pnpm test` builds first; CI builds before `test:fast`).
- Next (M5): docs with Fumadocs in apps/web. Write `llms.txt` from one source (the For agents page) and test it under 4,000 tokens. Every ```canon block must pass `check` or carry `# expect: CODE`.

### M5 (done)
- Fumadocs (macro style, `fumadocs-mdx/macro` in lib/source.ts) with the `@fumadocs/base-ui` UI package, static search, and a custom Shiki grammar (lib/canon-grammar.ts). The 17 pages are in apps/web/content/docs; apps/web/test/docs.test.ts checks them.
- A docs subagent wrote the page content; its findings led to checker and CLI fixes (DECISIONS.md, "M5: fixes").

### M6 (done)
- The landing page is app/(home)/page.tsx and the playground is app/(home)/play (components/playground.tsx with CodeMirror 6, lib/run-worker.ts). Numbers and variants come from lib/generated/site.json, written by `scripts/stats.ts --write` in the web build script.
- e2e/smoke.spec.ts (Playwright) serves apps/web/out with scripts/serve-static.mjs (gzip). CI installs Chromium and runs `pnpm e2e` after the web build.
- Tricky: the worker must receive the program by postMessage (an early bug). Turbopack bundles `new Worker(new URL(...), { type: "module" })` fine.

### M7 (done)
- README.md, CONTRIBUTING.md, DEPLOY.md, and LICENSE (MIT, from the original repository); tests/release.test.ts checks them and the 0.1.0 versions.
- The remaining steps need the owner: Vercel import with root apps/web plus NEXT_PUBLIC_GITHUB_URL, and `npm publish` of canon-lang (see DEPLOY.md). M8 needs model access.
- Next session: M8 only, if the owner provides model access. Otherwise maintenance.

### M8 (done)
- Likelihood study done with local Qwen2.5-Coder 1.5B and 7B (research/likelihood). Strongest finding: models strongly prefer `x = ...` over `set x = ...`, and `while` over `for cond`. Results are in the Design notes page.
- Benchmark: Claude Opus 5.5 and GPT-6.2 Sol, with keys in .env.local (git-ignored). Generated modules now expose `fns` so harnesses can call Canon functions directly.
- Benchmark done: 2,000 runs. Pre-registered verdicts: C1 (understood), C2 (correct) and C4 (as fast) supported; **C3 (convergence, the core bet) not supported**; C5 (runtime speed) not tested. The exploratory analysis points at `match` placement, the missing early loop exit, and helper naming as the sources of divergence. The next step is a new pre-registered run after changing those.

### Language v0.2 (after M8)
- Four changes from the M8 data: `x = e` (not `set`), `while cond` (not `for cond`), `+` joins strings (no `concat`), `match` anywhere (S001 retired, and parenthesized as an operand). v0 spellings still parse and fmt migrates them. The reference was trimmed to about 2,000 tokens.
- The conformance test keeps oracle byte-equality for every file that touches none of the changed constructs.
- Benchmark v0.2: PREREGISTRATION-v0.2.md is committed before the run; src/report-v02.ts applies it (95% intervals, structural metric, cost, v0.2 vs v0).
- v0.2 benchmark done (2,000 runs, $7.95 Claude). C1, C2 and C4 are supported; C3, C3s, C6, D1 and D1s are not. The v0.2 changes did not move convergence, and cost is driven by output tokens, not the reference. Results are in the Design notes and on the landing page.
