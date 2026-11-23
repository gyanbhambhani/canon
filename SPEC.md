# Canon v0: Build Spec for Claude

Nov 22, 2026 · Gyan

This document is a build spec. Hand it to Claude Code together with the Python reference implementation, and it builds Canon end to end: compiler, runtime, CLI, docs site, landing page with a browser playground, and CI.

## How to use this spec

1. Make an empty folder named canon and unzip canon-v0.zip into canon/reference/, so the file sits at canon/reference/canon.py.
2. Export this doc as Markdown and save it as canon/SPEC.md.
3. Open Claude Code in canon/ and paste the prompt below.
4. If a session ends before the work is done, paste the same prompt again. Claude resumes from the ticked boxes in ROADMAP.md. Every milestone leaves the repo in a working, tested state, so stopping anywhere is safe.

```
Read SPEC.md fully before writing any code. You are building Canon, the language it
describes, as a pnpm monorepo in this folder, following the Architecture section exactly.

The Python implementation in reference/ is the oracle. Your TypeScript front end must
produce byte-identical fmt output and the same diagnostic codes as reference/canon.py
on every conformance file.

Work through the milestones M0 to M7 in order. For each milestone:
1. Write its acceptance tests first.
2. Implement until they pass. Run the full test suite before every commit.
3. Commit with a message that names the milestone, then tick its boxes in ROADMAP.md.

Rules: follow CLAUDE.md. Never edit or delete a test to make it pass. Do not stop to
ask me questions; record every judgment call in DECISIONS.md and keep going. Stop only
when M7 is done, or when you need something only I can provide (an account, a secret,
a domain). Then tell me exactly what you need and why.
```

## Definition of done

The build is done when a stranger can open the landing page, run Canon in the browser, read the docs, and run the CLI from a clone of the repo.

- [ ] `canon run examples/hello.cn` prints `hello, canon`
- [ ] `canon check`, `canon fmt`, `canon test` and `canon run` work on every file in examples/
- [ ] The TypeScript front end matches reference/canon.py byte for byte on the whole conformance corpus
- [ ] The type checker accepts every program in tests/types/pass and rejects every program in tests/types/fail with its expected code
- [ ] Every program in tests/run prints its expected output
- [ ] The browser playground at /play formats, checks and runs Canon with no server
- [ ] The docs site at /docs has every page in the Docs site section, and CI checks every code block in it
- [ ] The landing page at / builds, and its GitHub link comes from the NEXT_PUBLIC_GITHUB_URL environment variable
- [ ] CI on GitHub Actions runs every test and the web build, all green
- [ ] DEPLOY.md lists the steps only the owner can do: create the GitHub repo, push, import to Vercel, publish to npm

Out of scope for this build: a native backend, a package manager, an editor language server, concurrency, modules beyond the built-in standard library, and the M8 research milestone (planned as a stretch goal).

## Thesis

Canon is a compiled language whose main user is an AI coding agent, and its one job is to make every intent map to as close to one valid program as possible.

The randomness in AI-written code comes from sampling, and no language can remove that. What a language controls is how many legal programs exist for the same intent. JavaScript allows dozens of ways to write a button, so two agent runs drift apart and reviewers chase style instead of logic. Canon removes that freedom on purpose: one way to loop, one way to branch, one way to handle errors, one textual form per program.

Three bets follow from that goal:

1. **Shrink the program space.** Fewer legal programs per intent means agent runs converge, diffs stay small, and caches hit.
2. **Make the compiler a collaborator.** Errors come back as machine-applicable patches, so the write, compile, fix loop closes in one or two turns.
3. **Fit in one context window.** The full language reference stays under 4,000 tokens, so any agent can load all of it, the same way a good skill file primes an agent better than raw text.

Humans remain readers and reviewers. Canon should read like clean Python or TypeScript to a person who has never seen it.

**The native dialect.** Canon does not ask a model to learn anything new. Every model already has a dialect it writes most reliably inside the languages it knows: the forms it has seen millions of times and assigns high probability to. Canon's syntax borrows those familiar forms and then removes every alternative. A stretch milestone (M8) makes this measurable: score equivalent spellings of each construct with an open-weights model's token probabilities and adopt the form the model finds most natural.

## Design laws

Seven laws decide every feature question; a proposed feature that breaks one is rejected, however convenient.

1. **One text per program.** The formatter is part of the grammar. A file the formatter would change is a compile error, and the error carries the patch. Two programs with the same meaning are identical byte for byte.
2. **One construct per job.** One loop keyword, one conditional statement, one error mechanism, one way to call a function. Where two spellings could both make sense, a fixed rule picks one (see the pipeline rule in the language section).
3. **Everything local.** A line can be understood from its function header and the lines above it. No implicit imports, no global mutable state, no methods resolved at a distance, no operator overloading.
4. **Effects are exact.** A function lists exactly the effects it uses, no more and no fewer. Pure is the default, and leaving out the clause means pure.
5. **Boundaries are typed, interiors are inferred.** Every signature spells out its parameter and return types. Local bindings never carry annotations, so there is one way to write them.
6. **The grammar is small enough to constrain decoding.** Braces delimit blocks and no rule depends on indentation, so a decoding engine can mask invalid tokens and the agent never emits a syntax error.
7. **The reference fits in 4,000 tokens.** Any feature that pushes the language reference past that budget must replace something already in it.

## The language

This section is the entire reference an agent loads: about 1,100 tokens (3,729 characters), a quarter of the 4,000-token budget. Every code sample in it passes canon check.

**Files and text.** Source files end in .cn. Blocks use braces, indentation is two spaces, and statements sit one per line. Comments start with # and take a whole line. Strings use double quotes only. Values, functions, fields and effects are snake_case; types and variants are PascalCase. One line rule matters to the parser: a call's ( sits on the same line as the function name.

**Types.** Built in: Int, Float, Bool, String, Unit, List[T], Map[K, V], Option[T], Result[T, E], tuples (A, B), and function types fn(A) -> B. Declare records and sum types like this:

```canon
type Item {
  sku: String,
  qty: Int,
  price: Float,
}

type Step =
  | Call(tool: String, input: Json)
  | Answer(text: String)
  | Fail(reason: String)
```

**Functions.** Parameter and return types are always written. Optional clauses follow the signature in the fixed order effects, requires, ensures; result names the return value inside ensures. Leaving out effects means pure. The effects are fs, io, net, rand, time, listed exactly and alphabetically.

```canon
fn restock_cost(items: List[Item], target: Int) -> Float
  requires: target >= 0
  ensures: result >= 0.0
{
  var total = 0.0
  for item in items {
    if item.qty < target and not is_discontinued(item) {
      set total = total + to_float(target - item.qty) * item.price
    }
  }
  return total
}
```

**Statements.** let binds an immutable name, var a mutable one, and set assigns to a var, so every mutation is searchable. Locals never carry type annotations. return is always explicit. if / else if / else is the only conditional statement. for x in xs { } walks a collection and for cond { } repeats while true; there is no other loop. A bare expression statement must be a call.

**Expressions.** Precedence, loosest first:

| Level | Operators |
|---|---|
| 0 | `\|>` pipeline, lambdas `\|a, b\| expr` |
| 1 | `or` |
| 2 | `and` |
| 3 | `not` |
| 4 | `== != < <= > >=` (never chained) |
| 5 | `+ -` |
| 6 | `* / %` |
| 7 | unary `-`, `try` |
| 8 | calls `f(x)`, fields `a.b`, tuple slots `t.0` |

Only named functions are called; there are no methods. Literals: `[1, 2]`, `(a, b)`, `Item { sku: "a", qty: 1, price: 2.5 }`. A lambda body is one expression. `try e` unwraps a Result or returns its error early. match is allowed only as the whole value of let, set or return, with one arm per line:

```canon
let band = match (item.qty > 0, item.price) {
  (false, _) => "out",
  (true, 0.0) => "free",
  _ => "priced",
}
```

**The pipeline rule.** `x |> f(y)` means `f(x, y)`. Whether a chain is written as a pipeline or as nested calls is not a choice: three or more chained calls are a pipeline with one stage per line, and fewer are nested calls. A call whose first argument is a literal, such as `range(0, n)`, can start a pipeline but never becomes a stage.

```canon
return items
  |> filter(|i| i.qty > 0 and i.price > 0.0)
  |> sort_by(|i| i.price)
  |> take(k)
  |> map(|i| i.sku)
```

**Holes.** Write `?` or `?name` where you are unsure. The compiler reports the type the hole needs and the functions in scope that return it, then you fill it.

**What fmt collapses.** The checker rejects any file fmt would change, and the error carries the patch. All of these collapse to one form: whitespace and blank lines; redundant parentheses; optional commas; `else { if … }` to `else if`; `x == true` to `x` and `x == false` to `not x`; `not not x` to `x`; `007` to `7` and `1.50` to `1.5`; import order and duplicates; effect order; clause order; pipeline versus nested call.


### Amendment: v0.2 (2026-11-22)

After the M8 studies, four rules above changed. DECISIONS.md has the evidence for each, and the docs and the implementation follow v0.2.

- Assignment is `x = e` (and `p.field = e`) on a `var`; `set` is retired.
- The condition loop is `while cond { }`; `for x in xs { }` remains the collection loop.
- Strings join with `+`; `concat` is removed.
- `match` may appear in any expression position; S001 is retired.

The v0 spellings still parse, and fmt rewrites them, so every v0 program migrates with `canon fmt --write`.

### Amendment: v0.3 (2026-11-22)

docs/v0.3-proposal.md has the evidence, the ranking and the planned pre-registered test; DECISIONS.md has each judgment call. Every change below has a switch (packages/compiler/src/features.ts; `--no-<name>` on the CLI, `--v0.2` for all), so an experiment can ablate each one.

- The logical operators are `&&`, `||` and `!` (likelihood study: symbols preferred in every context by the 7B model). `!` is unary at level 7, beside `-` and `try`; fmt rewrites `and`, `or`, `not`, and `not a == b` becomes `!(a == b)`.
- `break`, alone on its line, leaves the innermost loop (T010 outside one). There is no `continue`.
- `for (a, b) in xs { }` destructures tuple elements.
- fmt breaks a statement longer than 100 characters at its outermost list, tuple, record or call brackets, one item per line with a trailing comma; L001 remains for lines it cannot break.
- Test blocks are effect-checked: `fs` and `net` are declared with an `effects:` line after the test name; `io`, `time` and `rand` are virtual under the test host and never declared. `requires` and `ensures` must be pure (E103).
- At run time the host performs only the effects the entry point declares (the capability guard, R006).
- `canon check --fix` applies C001, E101, E102 and T009 patches to a fixed point and reports only what needs judgment. T001 may carry ranked candidate patches in `data.suggestions`.
- `canon test` also fuzzes every pure, non-generic function with a contract on seeded inputs generated from its parameter types.

Design law 1 holds: fmt still decides one text per program, including where long lines break. v0.2 files migrate with `canon fmt --write`, except a test block that uses `fs` or `net`, which needs `canon check --fix --write`.

## Runtime semantics

This section defines what a Canon program does when it runs. Where this section and the reference implementation are silent, the implementer decides and records the decision in DECISIONS.md.

**Values.** Int is a whole number; any result outside the safe 53-bit range traps (R003). Float is a 64-bit float. String is immutable Unicode text with escapes `\"`, `\\`, `\n` and `\t`. Unit is the result of functions with nothing to return. Lists, tuples, records and variants are immutable values: passing one to a function can never change the caller's copy, and `set p.field = v` on a var record rebinds p to an updated copy.

**Built-in types.** Option[T] is `Some(value: T) | None`. Result[T, E] is `Ok(value: T) | Err(error: E)`. Error is the record `Error { message: String }`.

**Arithmetic and comparison.** Int with Int gives Int, and Float with Float gives Float. Mixing them is a type error (T009), and its patch wraps the Int side in to_float. Int division truncates toward zero. Dividing by zero, or taking % of zero, traps (R004). `<`, `<=`, `>` and `>=` work on Int, Float and String (by code point). `==` and `!=` compare any two values of the same type by structure, except functions (a type error).

**Evaluation.** Strict, left to right; arguments are evaluated before the call. and and or short-circuit. Lambdas capture values, never variables. A lambda with n parameters that receives a single n-tuple unpacks it, which is how `map(pairs, |k, v| ...)` works.

**Control.** A function whose return type is not Unit must return on every path (T005). A Unit function may fall off the end. `try e` requires a Result: `Ok(v)` becomes v, and `Err(x)` makes the enclosing function return `Err(x)` at once, so that function must itself return a Result with the same error type (T007). match tries arms top to bottom and must cover every case (T004); the T004 patch adds the missing arms with holes as their values.

**Contracts.** requires is checked on entry and ensures on every return, with result bound to the returned value. A failure traps with R001 or R002, naming the function. `canon run --no-contracts` skips both.

**Traps.** A runtime error stops the program and prints one JSON object with code, message, line, col and a Canon-level stack. R001 requires failed · R002 ensures failed · R003 integer overflow · R004 division by zero · R005 assert failed · R006 effect denied by the host.

**Effects at runtime.** Effectful built-ins go through a host object, so the CLI, the browser and the test runner can each supply their own. `canon run --deny net,fs` makes those calls trap with R006. Under canon test, time starts at 0 ms and only advances through sleep, and rand is seeded with 42, so every test run is reproducible. The browser playground allows io, time and rand and denies fs and net.

**Entry point and modules.** `canon run file.cn` calls `fn main() -> Unit`, which may declare any effects. If main returns a Result, an Err prints its message and exits with status 1. `canon test file.cn` runs every test block and prints a pass/fail summary. In v0 a program is one file plus the standard library: `use std.<name>` lines are accepted, and any other use is error M001 ("modules arrive in v1"). The reference examples that import other modules are front-end conformance files only, never run.

**Standard library.** Built-ins follow the same rules as user code: no overloading, and generics only through type parameters. K below means Int, Float or String.

| Function | Signature | Effect |
|---|---|---|
| len | `[T](xs: List[T]) -> Int` | |
| map | `[A, B](xs: List[A], f: fn(A) -> B) -> List[B]` | |
| filter | `[A](xs: List[A], f: fn(A) -> Bool) -> List[A]` | |
| fold | `[A, B](xs: List[A], init: B, f: fn(B, A) -> B) -> B` | |
| sum / sum_float | `(xs: List[Int]) -> Int` / `(xs: List[Float]) -> Float` | |
| sort_by / sort_desc_by | `[A, K](xs: List[A], key: fn(A) -> K) -> List[A]`, stable | |
| group_by | `[A, K](xs: List[A], key: fn(A) -> K) -> List[(K, List[A])]`, first-seen order | |
| take / drop | `[A](xs: List[A], n: Int) -> List[A]` | |
| first / last | `[A](xs: List[A]) -> Option[A]` | |
| append | `[A](xs: List[A], x: A) -> List[A]` | |
| contains | `[A](xs: List[A], x: A) -> Bool` | |
| reverse | `[A](xs: List[A]) -> List[A]` | |
| zip | `[A, B](xs: List[A], ys: List[B]) -> List[(A, B)]` | |
| enumerate | `[A](xs: List[A]) -> List[(Int, A)]` | |
| range | `(start: Int, end: Int) -> List[Int]`, end excluded | |
| min / max | `(a: Int, b: Int) -> Int` | |
| abs / pow | `(n: Int) -> Int` / `(base: Int, exp: Int) -> Int` | |
| to_string | `[T](x: T) -> String` | |
| to_float / to_int | `(n: Int) -> Float` / `(x: Float) -> Int`, truncates | |
| parse_int / parse_float | `(s: String) -> Option[Int]` / `Option[Float]` | |
| concat | `(parts: String, ...) -> String`, the only variadic built-in | |
| join | `(parts: List[String], sep: String) -> String` | |
| split | `(s: String, sep: String) -> List[String]` | |
| trim / str_len | `(s: String) -> String` / `(s: String) -> Int` | |
| unwrap_or | `[T](o: Option[T], fallback: T) -> T` | |
| map_from | `[K, V](pairs: List[(K, V)]) -> Map[K, V]` | |
| map_get / map_set | `(m, k) -> Option[V]` / `(m, k, v) -> Map[K, V]` | |
| keys / values | `(m: Map[K, V]) -> List[K]` / `List[V]`, insertion order | |
| assert | `(cond: Bool) -> Unit`, traps R005 | |
| print | `(s: String) -> Unit` | io |
| read_line | `() -> Option[String]` | io |
| read_file / write_file | `(path: String) -> Result[String, Error]` / `(path: String, text: String) -> Result[Unit, Error]` | fs |
| http_get / http_post | `(url: String) -> Result[String, Error]` / `(url: String, body: String) -> Result[String, Error]` | net |
| now / sleep | `() -> Int` (ms since epoch) / `(ms: Int) -> Unit` | time |
| random / random_int | `() -> Float` in [0, 1) / `(lo: Int, hi: Int) -> Int`, hi excluded | rand |

**Type checking.** Locals are inferred by unification within each function. Lambda parameter types come from the expected type at the call site, so `map(xs, |x| x + 1)` needs no annotations. Holes are allowed anywhere and report their expected type (H001). Type errors: T001 mismatch · T002 unknown name · T003 wrong argument count · T004 non-exhaustive match · T005 missing return · T006 set on a let · T007 try outside a matching Result function · T008 unknown field · T009 mixed Int and Float.

## The compiler as a collaborator

Every diagnostic is JSON with a stable code, a position, and, wherever the fix is mechanical, a unified-diff patch the agent applies without rewriting the file. Prose explanations are for humans; the patch is for the agent.

The agent applies patches mechanically and treats holes as questions; only parse and naming errors send it back to rewrite code itself.

A missing effect, exactly as the reference checker prints it:

```json
{
  "code": "E101",
  "severity": "error",
  "message": "fn greet uses effects it does not declare: io (via print)",
  "line": 1,
  "col": 4,
  "fix": {
    "kind": "patch",
    "diff": "--- a/greet.cn\n+++ b/greet.cn\n@@ -1,3 +1,5 @@\n-fn greet(name: String) -> Unit {\n+fn greet(name: String) -> Unit\n+  effects: io\n+{\n   print(name)\n }\n"
  },
  "data": { "missing": ["io"] }
}
```

A typed hole asks the compiler a question instead of guessing. The answer names the type the hole needs and every function in scope that returns it:

```json
{
  "code": "H001",
  "message": "hole ?best in fn score: needs a value of type Int",
  "line": 10,
  "col": 10,
  "data": {
    "expected": "Int",
    "candidates": ["total(xs: List[Int]) -> Int", "biggest(xs: List[Int]) -> Int"]
  }
}
```

The v0 diagnostic set:

| Code | Meaning | Patch included |
|---|---|---|
| P001 to P005 | Parse errors, each naming what was expected | No |
| C001 | File is not in canonical form | Yes, the whole normalization |
| S001 | match used inside a larger expression | No |
| L001 | Line over 100 characters | No (bind with let) |
| N001 | Naming rule broken | No |
| E100 | Unknown effect name | No |
| E101 | Effect used but not declared | Yes |
| E102 | Effect declared but never used | Yes |
| H001 | Hole, with expected type and candidates | No (it is a question) |

Patches are computed against the original file, so one patch fixes the reported problem and any formatting drift together. The test suite applies the E101 patch with the system patch tool and confirms the result passes.

The full build adds type errors (T001 to T009) and runtime traps (R001 to R006), defined in the Runtime semantics and Milestones sections.

## Architecture

Canon is built as one TypeScript monorepo, so the same compiler code runs in the CLI, in tests and in the browser playground.

```
canon/
  SPEC.md               this document
  ROADMAP.md            the milestone checkboxes, copied from Milestones
  DECISIONS.md          judgment calls, newest first: date, decision, reason
  CLAUDE.md             rules for agents (see the CLAUDE.md section)
  DEPLOY.md             steps only the owner can do
  reference/            Python v0 implementation: the oracle, never edited
  packages/
    compiler/           lexer, parser, normalizer, printer, checker, type checker, JS codegen
    runtime/            standard library, effect hosts (node, browser, test), traps
    cli/                the `canon` command: check, fmt, run, test
  apps/
    web/                Next.js: landing page at /, docs at /docs, playground at /play
  examples/             runnable programs: hello, fizzbuzz, word count, orders ranking, result and try
  tests/
    conformance/        .cn inputs with expected .fmt.cn and .diag.json produced by the oracle
    types/pass/         programs that must type-check
    types/fail/         programs that must fail, expected code in the first-line comment
    run/                programs with an .out file holding the expected stdout
  scripts/
    oracle.ts           runs reference/canon.py to regenerate conformance expectations
    stats.ts            prints the numbers the landing page shows
  .github/workflows/ci.yml
```

**Technology choices.**

| Area | Choice | Why |
|---|---|---|
| Language for the toolchain | TypeScript, strict mode, Node 20 or later | One codebase for CLI and browser |
| Packages and tests | pnpm workspaces, Vitest | Fast, standard, monorepo-friendly |
| First backend | Compile Canon to an ES2022 JavaScript module plus the runtime package | Runs everywhere today, including the playground; a native backend comes later |
| Compiler dependencies | None | It must run unchanged in Node and the browser |
| Web app | Next.js App Router, Tailwind CSS | Landing page, docs and playground in one deployable app |
| Docs | Fumadocs inside the Next.js app, MDX content in apps/web/content/docs | GitBook-style sidebar, search and table of contents with no separate service |
| Playground editor | CodeMirror 6 with a small Canon syntax mode | Light, works in a Web Worker setup |
| Deploy | Vercel, from apps/web | Needs the owner's account, so it is the last step |
| Package name | canon-lang (binary canon), placeholder until published | Avoids name collisions on npm |

**The oracle rule.** For anything the Python reference already does (lexing, parsing, formatting, naming, effects, holes), its output is the spec. scripts/oracle.ts shells out to `python3 reference/canon.py` to produce expected outputs, and the TypeScript tests compare byte for byte. New behavior (types, codegen, runtime) is specified by this document and the tests written in each milestone.

## Milestones

Eight milestones take Canon from the Python prototype to a running language with a website; each ends green and committed, so the build can stop after any of them. Copy this section into ROADMAP.md at M0 and tick boxes there.

### M0: Scaffold

Set up the monorepo exactly as in Architecture, with CI running from the first commit.

- [ ] `pnpm install && pnpm test` passes on a clean clone
- [ ] .github/workflows/ci.yml runs lint, type-check, all tests and the web build on every push
- [ ] `pnpm oracle` regenerates tests/conformance expectations from reference/canon.py
- [ ] ROADMAP.md, DECISIONS.md and CLAUDE.md exist

### M1: Front end in TypeScript

Port the lexer, parser, normalizer, printer and checker (naming, effects, holes) from reference/canon.py.

- [ ] The conformance corpus holds every reference example plus at least 60 new cases covering each grammar rule and each diagnostic code
- [ ] fmt output is byte-identical to the oracle on every conformance file
- [ ] Diagnostic codes, lines and columns match the oracle on every conformance file
- [ ] Ported fuzzers (random whitespace plus the noisy printer) collapse 5,000 variants to their canonical texts with zero failures
- [ ] fmt is idempotent on every fuzzed variant

### M2: Type checker

Implement the type rules in Runtime semantics, including inference for locals and lambdas, exhaustive match, and holes everywhere.

- [ ] At least 40 programs in tests/types/pass type-check
- [ ] At least 30 programs in tests/types/fail fail with their expected code, covering T001 to T009 and M001
- [ ] The T004 patch applies cleanly and the patched file then reports only H001 holes
- [ ] The T009 patch applies cleanly and the patched file passes
- [ ] H001 reports an expected type for holes in let bindings, arguments, returns and match arms

### M3: Code generation and runtime

Compile checked programs to JavaScript and implement the standard library, contracts, traps and effect hosts.

- [ ] At least 25 programs in tests/run print their expected output, including hello, fizzbuzz, word count, orders ranking with a pipeline, Result with try, and a match over a sum type
- [ ] Trap tests cover R001 to R006, each printing the JSON trap with the right code and line
- [ ] `--deny net` makes http_get trap with R006
- [ ] Under the test host, now() and random() give the same values on every run
- [ ] Every standard library function in the table has at least one test

### M4: CLI

Ship the canon command.

- [ ] `canon check`, `canon fmt [--write]`, `canon run [--deny ...] [--no-contracts]` and `canon test` work, each with `--json` output
- [ ] Exit codes: 0 success, 1 diagnostics or failed tests or traps, 2 usage error
- [ ] `node packages/cli/dist/index.js run examples/hello.cn` prints `hello, canon` from a clean clone after `pnpm build`
- [ ] CLI integration tests cover every command and flag

### M5: Docs site

Build the docs at /docs with the page tree in the Docs site section.

- [ ] Every page in the Docs site section exists with real content drawn from this spec
- [ ] A test extracts every Canon code block from the docs and runs check on it; examples marked as failing must fail with their stated code
- [ ] /llms.txt serves the agent reference as plain text, and a test keeps it under 4,000 tokens (counted as characters divided by 3.5)
- [ ] `pnpm --filter web build` passes

### M6: Landing page and playground

Build / and /play as described in the Landing page section.

- [ ] The playground formats, checks and runs hello.cn entirely in the browser, with execution in a Web Worker and a 2-second time limit
- [ ] Diagnostics with a patch show an Apply button that rewrites the editor contents
- [ ] The landing page's numbers come from scripts/stats.ts at build time
- [ ] The GitHub button reads NEXT_PUBLIC_GITHUB_URL and is hidden when it is unset
- [ ] A Playwright smoke test loads /, /docs and /play and runs one program

### M7: Release readiness

- [ ] README.md with the one-line pitch, a code sample, quickstart and links
- [ ] LICENSE (MIT), CONTRIBUTING.md, and version 0.1.0 in every package
- [ ] DEPLOY.md lists, in order: create the GitHub repo, push, set NEXT_PUBLIC_GITHUB_URL, import apps/web into Vercel, publish canon-lang to npm
- [ ] CI is green on the final commit

### M8 (stretch): Evidence

Only after M7, and only when the owner provides model access.

- [ ] research/likelihood/: score equivalent spellings of 10 to 15 constructs with a small open-weights model and report which form wins and by how much
- [ ] research/benchmark/: 40 tasks run 10 times each in Canon and in TypeScript, reporting distinct programs per task, first-pass check rate and fix rounds
- [ ] One chart per study, embedded in the docs Design notes page

## Landing page

The landing page at / makes one argument in under a minute: agents fail from too much freedom, and Canon removes it. Every number on it comes from scripts/stats.ts, never typed by hand.

**Sections, top to bottom.**

1. **Hero.** Headline: "The dialect models already speak." Subhead: "Canon is a programming language for AI agents. One way to write every program, effects in every signature, and a compiler that answers with patches." Buttons: Try it (to /play), Read the docs (to /docs), GitHub (from NEXT_PUBLIC_GITHUB_URL, hidden if unset).
2. **Many in, one out.** A two-pane code panel: on the left, a messy variant of orders.cn that changes every few seconds (cycle through 5 pre-generated fuzzed variants); on the right, the canonical text, which never changes. Caption: "[N] scrambled variants tested. One output."
3. **Three ideas,** as three short cards: One text per program (the formatter is the grammar), Effects you can see (`effects: net, time` in the signature, checked exactly), Patches, not prose (errors arrive as diffs an agent applies).
4. **The loop.** A simple drawing: write, check, apply patch or answer hole, check again, run. One sentence under it.
5. **Real code.** orders.cn with syntax highlighting and a Run button that opens it in /play.
6. **Numbers strip.** Reference size in tokens, fuzzed variants, conformance tests, standard library functions, all from scripts/stats.ts.
7. **Why this exists.** Three short paragraphs adapted from the Thesis section, ending with a link to Design notes in the docs.
8. **Footer.** GitHub, Docs, Playground, MIT license.

**Look and feel.** Clean and typographic: system sans for text, a monospace face for code, one accent color, generous whitespace, light and dark themes following the OS. No stock illustrations, gradients or animated backgrounds; the only motion is the code panel in section 2. Static rendering for everything except the playground. Lighthouse performance and accessibility at 90 or above.

**Playground (/play).**

- Editor on the left (CodeMirror 6, Canon highlighting), panels on the right: Diagnostics, Output.
- Buttons: Format, Check, Run, plus an Examples menu listing every file in examples/.
- Checking runs on every pause in typing (300 ms debounce). Each diagnostic shows its code, message and position, and an Apply button when it carries a patch.
- Run compiles in the browser and executes in a Web Worker, stopped after 2 seconds. print writes to Output; fs and net calls trap with R006 and a note that the browser denies them.
- The URL hash stores the editor contents, so a program can be shared by link.

## Docs site

The docs live at /docs as a GitBook-style site (Fumadocs: sidebar, search, per-page table of contents, previous and next links), and CI checks every Canon code block in them so the docs can never drift from the compiler.

**Page tree.**

1. Introduction: what Canon is, who it is for, the native-dialect idea in one page.
2. Quickstart: clone, build, `canon run examples/hello.cn`, then check, fmt and test.
3. Language guide, one page each:
   1. Files and syntax
   2. Types and declarations
   3. Functions, effects and contracts
   4. Statements and mutation
   5. Expressions and precedence
   6. Pattern matching
   7. Errors with Result and try
   8. Pipelines and the pipeline rule
   9. Holes
4. Canonical form: every rule fmt applies, each with a before and after example.
5. Diagnostics reference: every code (P, C, S, L, N, E, H, T, M, R) with a triggering example and, where one exists, its patch.
6. Standard library: one entry per function: signature, effect, one-line description, example.
7. CLI reference: every command, flag and exit code.
8. For agents: the complete language reference on a single page, the same text served raw at /llms.txt, kept under 4,000 tokens.
9. Design notes: Thesis, Design laws, the Wasp lesson, Landscape, Open questions, Roadmap, and M8 results once they exist.

**Rules for docs content.** Every runnable example must pass canon check. An example meant to show an error starts with a comment naming its expected code (`# expect: T004`), and the docs test confirms that code appears. Code blocks use a canon language tag for highlighting. Content is drawn from this spec; where the spec is silent, the docs describe what the implementation does, and the decision is recorded in DECISIONS.md.

## CLAUDE.md

Create this file at the repo root in M0, word for word. It keeps every session, and every future contributor's agent, working the same way.

```markdown
# Canon: rules for agents in this repo

## Source of truth
- SPEC.md defines the language, the architecture and the milestones. Read the section
  for your current milestone before writing code.
- reference/ is the Python oracle. Never edit it. When TypeScript and Python disagree on
  formatting or front-end diagnostics, Python wins unless DECISIONS.md says why not.

## How to work
- Work milestones in order. Find the next unticked box in ROADMAP.md.
- Write the acceptance tests for a milestone before implementing it.
- Never weaken, skip or delete a test to make it pass. If a test is wrong, fix it and
  explain why in DECISIONS.md.
- Run `pnpm test` before every commit. Commit only on green.
- Commit messages start with the milestone: `M2: exhaustive match check`.
- Tick boxes in ROADMAP.md as they pass.
- Do not stop to ask questions. Record each judgment call in DECISIONS.md
  (date, decision, reason) and continue.
- Stop only when all of M0 to M7 are ticked, or when you need something only the owner
  can provide. Then say exactly what is needed.

## Code rules
- packages/compiler has zero runtime dependencies and must run in Node and the browser.
- Diagnostics are JSON with stable codes. Every mechanical fix ships a unified-diff patch.
- The agent reference (docs "For agents" page and /llms.txt) stays under 4,000 tokens.
  CI enforces it.
- Numbers shown on the website come from scripts/stats.ts, never typed by hand.
- Every Canon code block in the docs passes `canon check` or fails with its `# expect:` code.
- Keep the language reference, the docs and the implementation in agreement. A change to
  one is a change to all three in the same commit.
```

## Memory and performance (future, not in this build)

Canon aims for Rust-class runtime speed with nothing for the agent to annotate, and it expects to win on compile speed rather than beat Rust at runtime. Lifetime annotations are where agents struggle most in Rust, so Canon has none.

**Mutable value semantics.** Every value behaves as if it were its own copy. Passing a list to a function can never let that function change the caller's list, and there are no shared mutable references to reason about. The compiler removes the copies: a value is moved on its last use, and large values are copied only when written while shared (copy on write). Shared immutable heap data is reference counted, so most programs need no garbage collector. This is the model the Hylo language is built around, and it removes the whole class of borrow-checker errors.

**No undefined behavior.** Integer overflow traps, list access is bounds-checked, and map iteration follows insertion order. Time and randomness are reachable only through the time and rand effects, so a run can be recorded and replayed exactly, which turns a flaky agent bug into a reproducible one.

**Compile targets.**

1. v0: after this build's JavaScript backend, transpile to C and let an existing C compiler do the optimizing, for native speed without writing an optimizer.
2. v1: a direct LLVM backend, with WebAssembly as a second target for sandboxed execution of agent-written code.
3. Later: content-addressed compilation. Each function is identified by a hash of its canonical text, and canonical form makes that hash stable, so an unchanged function is never recompiled or retested, even across repositories.

Compile speed comes from the same choices: a small grammar parsed in one pass, no borrow checker, and caching keyed by canonical hashes. Concurrency is out of scope for v0 (see open questions).

## Bootstrapping past zero training data

A new language starts with no examples in any model's weights, so Canon is designed to be usable on day one from context alone and then to generate its own training data.

1. **Borrow familiar syntax.** Braces, fn, let, match, |> and Python-style and/or/not all appear in languages models already write well, so most of what they know carries over.
2. **Ship the reference as a skill file.** At roughly 1,100 tokens, the full reference rides along in every agent prompt. No fine-tuning is needed to start.
3. **Constrain decoding.** Publish a grammar that decoding engines can enforce, so a model with no Canon training still cannot emit a syntax error. (The v0 parser is lenient by design; the strict canonical grammar is the next artifact, see roadmap.)
4. **Generate a verified corpus.** Have models translate tested open-source Python and TypeScript functions into Canon, compile them, and keep only translations that pass the original test suite. Canonical form deduplicates the corpus for free and strips all style noise from it.
5. **Train with the compiler as the reward.** Compiles, passes tests, and needs no patches is a cheap, exact reward signal for fine-tuning or reinforcement learning. This step needs a lab's compute, which makes it the pitch to a lab.
6. **Measure the thesis.** Give the same 100 prompts to agents writing Canon, TypeScript, Python and Rust, run each 10 times, and count distinct normalized programs per prompt, first-pass compile rate, and turns to a green build. If Canon does not cut the distinct-program count sharply, the core bet is wrong.

## Starting point: the Python reference in reference/

The Python files ship unchanged in reference/. They are the oracle for M1, and their own test suite must keep passing there (`python3 reference/test_canon.py`).

A working front end now enforces the canonical-form law: 15,000 randomly scrambled versions of three programs each collapsed back to their single canonical text, with zero failures. It is about 1,500 lines of dependency-free Python (canon.py) with a 16-case test suite (test_canon.py).

**How the law is enforced.** The parser is deliberately loose. It accepts any whitespace, extra parentheses, optional commas, and pipelines or nested calls interchangeably, so every surface variant of a program produces the same tree. A normalizer then collapses the semantic no-ops agents tend to write (x == true, not not x, unsorted imports). The printer turns that tree into exactly one text. A file is accepted only if it equals the printed form of its own tree, so the set of legal files is precisely the set of fixed points of fmt.

**Results.**

| Test | Result |
|---|---|
| Canonical examples are fixed points of fmt | 3 of 3 files |
| Hand-written messy file (36 lines) formats to the canonical file (60 lines) | Identical output |
| Structural fuzz: extra parens, pipeline vs calls, commas, else { if }, random whitespace | 1,200 distinct variants, all collapse; 15,000 in the stress run |
| fmt is idempotent on every variant | Pass |
| Pipeline rule, boolean collapse, literal forms, required vs redundant parens | Pass |
| Six forbidden constructs (local annotations, single quotes, chained comparisons, bare non-call statements, missing return type, nested match) | Each rejected with its own code |
| Effect checking, including propagation through user functions | Pass; E101 patch applies cleanly and the fixed file passes |
| Typed hole reports expected type and both candidate functions | Pass |
| Naming, parse-error positions, CLI exit codes | Pass |

**What the fuzzing taught.** Two real design flaws surfaced and were fixed; both rules are now in the reference.

- The first pipeline rule turned `range(0, attempts)` into `0 |> range(attempts)`. That was deterministic but unreadable, so a call whose first argument is a literal can no longer become a pipeline stage.
- Ignoring all line breaks let a statement starting with ( glue itself onto the previous line as a call. The fix is the rule Go and Swift use: a call's ( must sit on the function name's line. It is the only line break that matters in the grammar.

**Not built yet.** A full type checker (holes infer only return positions and call arguments today), code generation, and the strict canonical grammar for constrained decoding. One known edge: a record literal directly in an if condition prints without the parentheses the parser needs.

**Running it.** `python canon.py check file.cn` prints JSON diagnostics and exits 1 on errors. `python canon.py fmt file.cn` prints the canonical form. `python test_canon.py` runs the suite in about 1.5 seconds.

## Landscape, open questions, roadmap

Others are building languages for agents, but none treats one-text-per-program as the core law, and that is Canon's opening.

| Project | Its main bet | Where Canon differs |
|---|---|---|
| MoonBit | A flat language plus a sampler that enforces syntax and catches type errors while the model generates (Feb 2024 post) | MoonBit fixes code during sampling; Canon makes the space of valid programs small to begin with, and the two ideas combine |
| ll-lang | Compact functional syntax, 15 keywords, coded diagnostics, an MCP server, transpiles to F#, TypeScript, Python, Java, C# | ll-lang optimizes for fewer tokens; Canon optimizes for fewer legal programs and returns patches rather than only error codes |
| Armin Ronacher's essay | Design principles: explicit types and effects, braces, results over exceptions, greppable code, local reasoning | Canon adopts most of these and adds canonical form, typed holes and exact effects |

**Open questions.**

- **Trailing commas.** Ronacher argues against trailing-comma conventions and multi-line constructs for diff stability. Canon puts one record field or match arm per line with a trailing comma, which keeps diffs to one line per change. This needs measuring, not arguing.
- **Is the pipeline threshold right?** Three stages is a judgment call. The benchmark in the bootstrapping section should test two, three and four.
- **Concurrency.** Options are structured spawn blocks behind a par effect, or actors in the Erlang style. Either must keep runs replayable.
- **Generics depth.** v0 has type parameters but no interfaces. Adding interfaces risks the many-ways problem returning through clever abstractions.
- **Escape hatch.** Some code will need foreign calls into C or Rust libraries. That boundary should be explicit and carry its own effect.

**Roadmap.** The Milestones section is the roadmap for this build. After M8, the next artifacts are:

1. **Strict grammar.** The canonical grammar in a form constrained-decoding engines accept, so models cannot emit non-canonical text at all.
2. **Native backend.** Compile through C, then LLVM, and benchmark against Rust and Go.
3. **Corpus pipeline.** Translate and verify open-source functions into Canon; this is the artifact to bring to a lab.

## Sources

- MoonBit: Exploring the design of an AI-Native Language Toolchain, MoonBit blog, Feb 18, 2024
- Why We Built ll-lang, Roman Melnikov, DEV Community
- A Language For Agents, Armin Ronacher, Feb 9, 2026
