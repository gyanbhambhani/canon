# Contributing to Canon

Thanks for helping. Canon's one job is to make every intent map to as close to one valid program
as possible, so changes are judged against the seven design laws in [SPEC.md](SPEC.md). A feature
that breaks one is declined, however convenient.

## Setup

Node 20 or later, pnpm 10, Python 3 (for the reference oracle), git.

```bash
pnpm install
pnpm test          # builds the packages, then runs every unit, conformance, type, run and CLI test
pnpm lint
pnpm typecheck
pnpm --filter web build && pnpm e2e    # the website and its Playwright smoke test
```

## Ground rules

These are the same rules agents follow in [CLAUDE.md](CLAUDE.md).

- **The oracle wins.** `reference/canon.py` is never edited. The TypeScript front end must match
  its fmt output and diagnostics byte for byte. After adding a file to `tests/conformance`, run
  `pnpm oracle` to regenerate its expectations.
- **Tests first, never weakened.** Write the failing test, then the code. Never skip or delete a
  test to get green. If a test is wrong, fix it and say why in `DECISIONS.md`.
- **Record judgment calls** in `DECISIONS.md`, newest first: date, decision, reason.
- **Keep three things in agreement:** the language reference (`apps/web/content/docs/for-agents.mdx`,
  served as `/llms.txt`, under 4,000 tokens), the docs, and the implementation. A change to one is
  a change to all three in the same commit.
- **Diagnostics are JSON with stable codes**, and every mechanical fix ships a unified-diff patch.
- **`packages/compiler` has zero runtime dependencies** and must run in Node and the browser.
- **Website numbers come from `scripts/stats.ts`**, never typed by hand.
- **Every ```canon block in the docs** passes `canon check`, or fails with its `# expect: CODE`.

## Layout

| Path | What |
| --- | --- |
| `packages/compiler` | lexer, parser, normalizer, printer, checks, type checker, JS codegen |
| `packages/runtime` | standard library, traps, effect hosts (node, browser, test) |
| `packages/cli` | the `canon` command (bundled to one file) |
| `apps/web` | landing page, docs (Fumadocs), playground |
| `tests/` | conformance corpus, type pass/fail corpora, run programs, CLI tests |
| `reference/` | the Python oracle |

## Commits

Small, focused, green. Start the message with the area or milestone, for example
`compiler: exhaustive match on nested tuples`.
