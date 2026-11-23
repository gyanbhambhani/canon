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

## Full-stack (v0.5)
- Generated code must meet the readability bar in docs/v0.5-fullstack.md. If a golden file
  and the generator disagree, fix the generator; never edit a golden file to make a test pass
  without recording why in DECISIONS.md.
- Generated Python depends only on FastAPI, Pydantic and the standard library. Generated
  TypeScript has no dependencies.
- A built-in allowed in api validation must have Python and TypeScript implementations and
  parity tests in the same commit.
- A wire-format change updates both generators, the golden files and the parity suite in the
  same commit.
- Nothing on the website claims agent results for full-stack until FS-1 reports.
