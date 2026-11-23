# Experiment FS-1 harness

FS-1 (docs/v0.5-fullstack.md): do agents ship more working full-stack features, with fewer
frontend–backend mismatches, in Canon than in Python and TypeScript directly?

```text
research/fs1/
  starters/{direct,openapi,canon}/  the shop app three ways (starters/README.md)
  harness/
    regression/                     the starter's behavior: 12 HTTP + 5 client tests (visible to agents)
    client-api.ts                   the API of client tests
    client-runner.ts                runs client tests and validation agreement against a live server
    arms.ts                         working copies, build (canon build / generate-client) and each arm's checks
    hidden.ts                       the hidden suite of a working copy, and FS-1's metrics
    verify.ts                       every reference solution passes in every arm
  conftest.py                       the pytest fixture (one per arm contract)
  tasks/<id>/                       task.json, task.md, hidden tests, reference/{direct,openapi,canon} (tasks/README.md)
  runner/
    models.ts                       Qwen (local MLX), claude-opus-5-5, gpt-6.2-sol
    run.ts                          the scaffold and runner (one JSONL line per run)
  results/                          raw runs
  DECISIONS.md                      judgment calls
  COMPILER_ISSUES.md                Canon bugs found on the way
```

## Setup

```sh
pnpm install && pnpm build            # from the repository root (the canon CLI)
cd research/fs1
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

## Commands

```sh
npx tsx --conditions=source harness/verify.ts                 # starters and every task, all arms
npx tsx --conditions=source harness/verify.ts cancel-order    # one task

# a local model: start mlx_lm.server first (research/exp1/.venv), on a free port
research/exp1/.venv/bin/mlx_lm.server --model mlx-community/Qwen2.5-Coder-7B-Instruct-8bit --port 8097
npx tsx --conditions=source runner/run.ts --model local:Qwen2.5-Coder-7B-Instruct-8bit --port 8097 \
  --tasks cancel-order --runs 1 --out results/smoke.jsonl
npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks cancel-order --out results/smoke.jsonl
npx tsx --conditions=source runner/run.ts --model gpt-6.2-sol --tasks cancel-order --out results/smoke.jsonl
```

API keys are read from the repository's `.env.local` (ANTHROPIC_API_KEY, OPENAI_API_KEY). GPT
dollars need `FS1_PRICE_GPT_IN` and `FS1_PRICE_GPT_OUT` (USD per million tokens); without them the
runs record tokens and `dollars: null`.

## A run

The agent gets one system prompt (the scaffold, plus one paragraph about the arm; the Canon arm
also gets the core reference and the full-stack addendum, whose size is recorded as
`referenceTokens`), then the task, the file list and the editable source files. It acts with
`<read path/>`, `<write path>…</write>`, `<run>check</run>`, `<run>test</run>` and `<done/>`.
Each reply that writes files is an edit round: the project is built, the arm's checks run (fixes
applied first), and the visible tests run. At most 5 edit rounds and 16 replies. Then the verdict:
build, checks (`checksOk`), and the hidden suite (`pass`, `mismatch`, `regressionFailures`,
`taskFailures`, `validation`), plus `falseAcceptance`, tokens, dollars and wall time.
