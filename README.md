<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
    <img src=".github/assets/wordmark-light.svg" alt="canon" width="220">
  </picture>
</p>

<p align="center"><strong>The programming language for AI agents.</strong><br>
Typed, compiled, and small enough to fit in a single prompt. Every compiler error ships with its fix.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/canon-lang"><img alt="npm" src="https://img.shields.io/npm/v/canon-lang?color=171717&label=canon-lang"></a>
  <a href="https://github.com/gyanbhambhani/canon/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/gyanbhambhani/canon/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-171717"></a>
</p>

<!-- generated:terminal -->
```text
$ canon check hello.cn
hello.cn:1:4: error E101: fn main uses effects it does not declare: io (via print)
  --- a/hello.cn
  +++ b/hello.cn
  @@ -1,3 +1,5 @@
  -fn main() -> Unit {
  +fn main() -> Unit
  +  effects: io
  +{
     print("hello, canon")
   }
hello.cn: 1 problem

# the agent applies the patch

$ canon check hello.cn
hello.cn: ok
$ canon run hello.cn
hello, canon
```
<!-- /generated:terminal -->

## Try it

```bash
npx canon-lang run hello.cn
```

- [Playground](https://canon-lake.vercel.app/play): write Canon in your browser and apply fixes as they appear.
- [Use Canon with your agent](https://canon-lake.vercel.app/docs/agents): give it the reference ([llms.txt](https://canon-lake.vercel.app/llms.txt)) and tell it to run `canon check --json` and apply every fix.
- [Docs](https://canon-lake.vercel.app/docs)

## What it looks like

```canon
type Order {
  id: Int,
  customer: String,
  amount: Float,
}

# Highest-spending customers, best first.
fn top_customers(orders: List[Order], n: Int) -> List[String]
  requires: n > 0
  ensures: len(result) <= n
{
  let ranked = orders
    |> group_by(|o| o.customer)
    |> map(|customer, os| (customer, sum_float(map(os, |o| o.amount))))
    |> sort_desc_by(|pair| pair.1)
    |> take(n)
  return map(ranked, |pair| pair.0)
}
```

Types on every signature, side effects (`io`, `fs`, `net`, `time`, `rand`) declared in it, contracts checked at runtime, and one formatted layout per program. It compiles to JavaScript and runs in Node 20 or the browser.

## Full-stack (v0.5)

Write the types, the endpoints and the logic once. `canon build` generates a FastAPI backend and a typed TypeScript client from the same source, so the two sides cannot disagree about a field name, and a validation rule is written once and enforced on the server and checked in the client before a request is sent.

```canon
table todos: Todo key id

type Todo {
  id: Int,
  title: String,
  done: Bool,
}

type NewTodo {
  title: String,
}

api fn create_todo(input: NewTodo) -> Todo
  route: POST "/todos"
  effects: store(todos)
  requires: str_len(trim(input.title)) > 0
{
  let todo = Todo { id: next_id(todos), title: trim(input.title), done: false }
  insert(todos, todo)
  return todo
}
```

```bash
npx canon-lang build          # backend/canon_generated/ (FastAPI, Pydantic) and frontend/src/canon/ (TypeScript)
npx canon-lang manifest       # every endpoint, with the tables and hosts it may touch
```

The generated code is meant to read as hand-written, passes `ruff`, `mypy --strict`, `tsc --strict`, `prettier` and `eslint`, and is read-only: editing it by hand is caught by `canon check` (G001). The UI stays in React and calls the generated client. See [examples/todos](examples/todos) and [examples/shop](examples/shop), the [full-stack quickstart](https://canon-lake.vercel.app/docs/fullstack/quickstart) and the [changelog](https://canon-lake.vercel.app/changelog).

What the experiments found is on the [research page](https://canon-lake.vercel.app/research), including the parts that went against Canon: frontier models sit at the ceiling on writing, fixing and changing code, a small local model loses at writing Canon, and Canon costs several times the tokens. The full-stack comparison with hand-written and OpenAPI-generated clients is partial.

## Benchmark

<!-- generated:benchmark -->
2,000 runs across 50 tasks with 2 frontier models (claude-opus-5-5, gpt-6.2-sol). Success criteria were committed before any data was collected.

| Metric | Canon | TypeScript |
| --- | --- | --- |
| Correct | 100% | 100% |
| Valid on the first try | 90–98% | 100% |
| Tries to working code | 1.02–1.10 | 1.00 |
| Distinct programs per task (lower is better; not improved yet) | 4.20–4.28 | 3.56–4.02 |
<!-- /generated:benchmark -->

Consistency (fewer distinct programs than TypeScript) is the hypothesis under test, and it has not held up yet. [Full results, the misses and the raw data](https://canon-lake.vercel.app/research).

## Quickstart from source

You need Node 20 or later and pnpm 10.

```bash
git clone https://github.com/gyanbhambhani/canon.git
cd canon
pnpm install
pnpm build
node packages/cli/dist/index.js run examples/hello.cn     # hello, canon
```

Then try the other commands on any file in `examples/`:

```bash
node packages/cli/dist/index.js check examples/mistakes/missing-effect.cn   # an error with its patch (--json for agents)
node packages/cli/dist/index.js fmt examples/orders.cn                      # the one formatted text (--write to rewrite)
node packages/cli/dist/index.js test examples/fizzbuzz.cn                   # test blocks, deterministic time and rand
node packages/cli/dist/index.js run examples/word_count.cn --deny net,fs
node packages/cli/dist/index.js build examples/hello.cn -o /tmp/hello.js       # one standalone file: node /tmp/hello.js
node packages/cli/dist/index.js fmt --syntax py examples/orders.cn          # the same program in Canon-Py, the opt-in Python-shaped syntax
```

## What's in this repo

| Path | What |
| --- | --- |
| [packages/compiler](packages/compiler) | Lexers and lenient parsers for brace syntax and Canon-Py, normalizer, canonical printers, naming, effect and hole checks, type checker (with effects on function types), project linker, JavaScript codegen, and the FastAPI and TypeScript-client generators. No runtime dependencies; runs in Node and the browser. |
| [packages/runtime](packages/runtime) | Standard library, tables, traps (R001 to R007), effect hosts for Node, the browser and tests. |
| [packages/cli](packages/cli) | The `canon` command: `check`, `fmt`, `run`, `test`, `build`, `manifest`, `dev`, each with `--json` where it applies (and `--watch`, `--syntax py`). |
| [apps/web](apps/web) | The site: the landing page at `/`, docs at `/docs`, the playground at `/play`, the research results at `/research`, `/changelog`, `/llms.txt`, `/llms-py.txt` and `/llms-fullstack.txt`. |
| [examples](examples) | hello, fizzbuzz, word count, orders ranking, Result and try; the full-stack apps `todos` and `shop` with React UIs; `mistakes/` holds the playground's broken programs. |
| [reference](reference) | The Python prototype; the TypeScript front end matches its output byte for byte. |
| [research](research) | The pre-registered studies and their raw data: the benchmarks, the likelihood study, Experiment 1, CanonBench, FS-1 and VA-1. |
| [tests](tests) | Conformance corpus, type pass/fail programs, run programs with expected output, the Canon-Py corpus (`tests/py`), CLI, build and watch tests. |

## The website

```bash
pnpm --filter web dev      # http://localhost:3000
pnpm --filter web build    # static export in apps/web/out
pnpm e2e                   # Playwright smoke test against the export
```

Set `NEXT_PUBLIC_GITHUB_URL` to show GitHub links on the site; they are hidden when it is unset.

## Links

- [SPEC.md](SPEC.md): the language, its design laws, the architecture and the milestones
- [ROADMAP.md](ROADMAP.md): milestone checklist and progress log
- [docs/v0.5-fullstack.md](docs/v0.5-fullstack.md): the full-stack build spec
- [Changelog](https://canon-lake.vercel.app/changelog): what changed in each version, and why
- [DECISIONS.md](DECISIONS.md): every judgment call made while building v0
- [DEPLOY.md](DEPLOY.md): the steps that need the owner's accounts (Vercel, npm)
- [CONTRIBUTING.md](CONTRIBUTING.md): how to work on Canon, and how it is checked
- [LICENSE](LICENSE): MIT

Out of scope for v0: a native backend, a package manager, a language server, concurrency, and modules beyond the built-in standard library. These are on the roadmap in [SPEC.md](SPEC.md).
