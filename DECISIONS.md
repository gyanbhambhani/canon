# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

## 2026-11-22 — Pin TypeScript 5.9, not the npm `latest` 7.x
Decision: use `typescript@~5.9` across the monorepo.
Reason: npm `latest` is now the native TypeScript 7 port; Next.js 16 and typescript-eslint still target 5.x.

## 2026-11-22 — Work on `main` in a fresh repository
Decision: `git init -b main` and commit each milestone on `main`.
Reason: the folder was not a git repository; the spec asks for one commit per milestone, and there is no remote yet (creating it is an owner step in DEPLOY.md).

## 2026-11-22 — Keep the zip and local Claude settings out of git
Decision: `.gitignore` excludes `canon-v0.zip` and `.claude/settings.local.json`.
Reason: the zip duplicates `reference/`, and local settings are per-machine.
