# Benchmark (M8)

Do agents write Canon correctly from its reference alone, and do their programs converge? 50 tasks ×
10 runs × {Canon, TypeScript} × {Claude Opus 5.5, GPT-6.2 Sol} = 2,000 runs.

- `PREREGISTRATION.md`: the decision rules (C1 to C5), committed before the run.
- `REPORT.md`: verdicts, metrics, per-task distinct counts, and a clearly labeled exploratory analysis.
- `results/runs.jsonl`: every run (prompts' outputs, first and final code, checker codes, tests, tokens, cost).
- `src/tasks.ts` (50 tasks), `src/reference.ts` + `src/validate-tasks.ts` (independent check of every expected value),
  `src/languages.ts` (check, normalize and test per language), `src/providers.ts` (Anthropic and OpenAI SDKs),
  `src/run.ts` (the runner), `src/report.ts` (applies the pre-registration), `src/selftest.ts` (harness self-test, no API calls).

```bash
# keys in .env.local at the repo root: ANTHROPIC_API_KEY=... and OPENAI_API_KEY=...
cd research/benchmark
npx tsx src/validate-tasks.ts
npx tsx --conditions=source src/selftest.ts
npx tsx --conditions=source src/run.ts --tasks all --runs 10 --concurrency 8 --budget 30   # resumable
npx tsx --conditions=source src/report.ts
```

The full run cost $7.89 for Claude (OpenAI cost depends on your pricing) and took about 25 minutes.
