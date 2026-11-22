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

- [ ] The conformance corpus holds every reference example plus at least 60 new cases covering each grammar rule and each diagnostic code
- [ ] fmt output is byte-identical to the oracle on every conformance file
- [ ] Diagnostic codes, lines and columns match the oracle on every conformance file
- [ ] Ported fuzzers (random whitespace plus the noisy printer) collapse 5,000 variants to their canonical texts with zero failures
- [ ] fmt is idempotent on every fuzzed variant

## M2: Type checker

Implement the type rules in Runtime semantics, including inference for locals and lambdas, exhaustive match, and holes everywhere.

- [ ] At least 40 programs in tests/types/pass type-check
- [ ] At least 30 programs in tests/types/fail fail with their expected code, covering T001 to T009 and M001
- [ ] The T004 patch applies cleanly and the patched file then reports only H001 holes
- [ ] The T009 patch applies cleanly and the patched file passes
- [ ] H001 reports an expected type for holes in let bindings, arguments, returns and match arms

## M3: Code generation and runtime

Compile checked programs to JavaScript and implement the standard library, contracts, traps and effect hosts.

- [ ] At least 25 programs in tests/run print their expected output, including hello, fizzbuzz, word count, orders ranking with a pipeline, Result with try, and a match over a sum type
- [ ] Trap tests cover R001 to R006, each printing the JSON trap with the right code and line
- [ ] `--deny net` makes http_get trap with R006
- [ ] Under the test host, now() and random() give the same values on every run
- [ ] Every standard library function in the table has at least one test

## M4: CLI

Ship the canon command.

- [ ] `canon check`, `canon fmt [--write]`, `canon run [--deny ...] [--no-contracts]` and `canon test` work, each with `--json` output
- [ ] Exit codes: 0 success, 1 diagnostics or failed tests or traps, 2 usage error
- [ ] `node packages/cli/dist/index.js run examples/hello.cn` prints `hello, canon` from a clean clone after `pnpm build`
- [ ] CLI integration tests cover every command and flag

## M5: Docs site

Build the docs at /docs with the page tree in the Docs site section.

- [ ] Every page in the Docs site section exists with real content drawn from this spec
- [ ] A test extracts every Canon code block from the docs and runs check on it; examples marked as failing must fail with their stated code
- [ ] /llms.txt serves the agent reference as plain text, and a test keeps it under 4,000 tokens (counted as characters divided by 3.5)
- [ ] `pnpm --filter web build` passes

## M6: Landing page and playground

Build / and /play as described in the Landing page section.

- [ ] The playground formats, checks and runs hello.cn entirely in the browser, with execution in a Web Worker and a 2-second time limit
- [ ] Diagnostics with a patch show an Apply button that rewrites the editor contents
- [ ] The landing page's numbers come from scripts/stats.ts at build time
- [ ] The GitHub button reads NEXT_PUBLIC_GITHUB_URL and is hidden when it is unset
- [ ] A Playwright smoke test loads /, /docs and /play and runs one program

## M7: Release readiness

- [ ] README.md with the one-line pitch, a code sample, quickstart and links
- [ ] LICENSE (MIT), CONTRIBUTING.md, and version 0.1.0 in every package
- [ ] DEPLOY.md lists, in order: create the GitHub repo, push, set NEXT_PUBLIC_GITHUB_URL, import apps/web into Vercel, publish canon-lang to npm
- [ ] CI is green on the final commit

## M8 (stretch): Evidence

Only after M7, and only when the owner provides model access.

- [ ] research/likelihood/: score equivalent spellings of 10 to 15 constructs with a small open-weights model and report which form wins and by how much
- [ ] research/benchmark/: 40 tasks run 10 times each in Canon and in TypeScript, reporting distinct programs per task, first-pass check rate and fix rounds
- [ ] One chart per study, embedded in the docs Design notes page

