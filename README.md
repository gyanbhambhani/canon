# Canon

**A programming language for AI agents: one way to write every program, effects in every signature, and a compiler that answers with patches.**

**Live site:** <https://canon-lake.vercel.app> ([docs](https://canon-lake.vercel.app/docs), [playground](https://canon-lake.vercel.app/play), [llms.txt](https://canon-lake.vercel.app/llms.txt))

Canon's syntax uses the forms models already write well (braces, `fn`, `let`, `match`, `|>`) and then removes every alternative. A file `canon fmt` would change is a compile error, so two programs with the same meaning are the same bytes. When an agent gets something wrong, the compiler replies with a JSON diagnostic and, wherever the fix is mechanical, a unified diff the agent applies as is.

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

Forget `effects: io` on a function that prints, and `canon check` answers:

```json
{
  "code": "E101",
  "message": "fn greet uses effects it does not declare: io (via print)",
  "line": 1,
  "col": 4,
  "fix": { "kind": "patch", "diff": "--- a/greet.cn\n+++ b/greet.cn\n@@ -1,3 +1,5 @@\n-fn greet(name: String) -> Unit {\n+fn greet(name: String) -> Unit\n+  effects: io\n+{\n   print(name)\n }\n" },
  "data": { "missing": ["io"] }
}
```

## Quickstart

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
node packages/cli/dist/index.js check examples/orders.cn          # diagnostics, with patches (--json for agents)
node packages/cli/dist/index.js fmt examples/orders.cn            # the one canonical text (--write to rewrite)
node packages/cli/dist/index.js test examples/fizzbuzz.cn         # test blocks, deterministic time and rand
node packages/cli/dist/index.js run examples/word_count.cn --deny net,fs
```

Or skip the clone: the CLI is on npm as [`canon-lang`](https://www.npmjs.com/package/canon-lang), so `npx canon-lang run hello.cn` works anywhere with Node 20 or later (`npm i -g canon-lang` gives you the `canon` command).

## What's here

| Path | What |
| --- | --- |
| [packages/compiler](packages/compiler) | Lexer, lenient parser, normalizer, canonical printer, naming, effect and hole checks, type checker, JavaScript codegen. No runtime dependencies; runs in Node and the browser. |
| [packages/runtime](packages/runtime) | Standard library, traps (R001 to R006), effect hosts for Node, the browser and tests. |
| [packages/cli](packages/cli) | The `canon` command: `check`, `fmt`, `run`, `test`, each with `--json`. |
| [apps/web](apps/web) | The site: the landing page at `/`, docs at `/docs`, the in-browser playground at `/play`, and `/llms.txt`. |
| [examples](examples) | hello, fizzbuzz, word count, orders ranking, Result and try. |
| [reference](reference) | The Python prototype: the oracle the TypeScript front end matches byte for byte. |
| [tests](tests) | Conformance corpus, type pass/fail programs, run programs with expected output, CLI tests. |

How it is checked:

- 128 conformance files match the Python oracle's `fmt` output and diagnostics exactly, patches included.
- 5,000 fuzzed variants each format back to their one canonical text.
- 92 programs pass or fail the type checker as expected.
- 32 programs print their expected output.
- Every Canon block in the docs passes `canon check`, or fails with the code it says it will.
- A Playwright smoke test runs a program in the browser.

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
- [DECISIONS.md](DECISIONS.md): every judgment call made while building v0
- [DEPLOY.md](DEPLOY.md): the steps that need the owner's accounts (Vercel, npm)
- [CONTRIBUTING.md](CONTRIBUTING.md): how to work on Canon
- [LICENSE](LICENSE): MIT

Out of scope for v0: a native backend, a package manager, a language server, concurrency, and modules beyond the built-in standard library. These are on the roadmap in [SPEC.md](SPEC.md).
