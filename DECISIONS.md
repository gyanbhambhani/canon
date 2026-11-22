# Decisions

Judgment calls made during the build, newest first. Each entry: date, decision, reason.

## 2026-11-22 — M1: source files are read with universal newlines
Decision: every tool reads `.cn` files through `readSource`, which turns `\r\n` and lone `\r` into `\n`.
Reason: the oracle opens files with Python's text mode, which does exactly this; without it a CRLF file gets a different C001 patch than the oracle prints.

## 2026-11-22 — M1: the front-end check keeps the oracle's built-in effect tables
Decision: `checkFront` uses the oracle's tables verbatim (no `random_int`, `drop`, `pow`, ...). The full checker (M2) uses the spec's standard library table.
Reason: front-end diagnostics must match the oracle byte for byte; with a larger table, a function that calls `to_float` and declares an unused effect would get E102 where the oracle stays silent.

## 2026-11-22 — M1: where the oracle crashes, Canon reports P001
Decision: a float literal that overflows (`1e999`) and a non-ASCII letter or digit outside strings and comments are P001 errors.
Reason: the oracle raises an uncaught Python exception in both cases (`repr(inf)` in the printer; `NAME_RE.match` returning None). A crash is not a diagnostic. No conformance file exercises these inputs, because the oracle has no output for them.

## 2026-11-22 — M1: the noisy printer never parenthesizes pattern literals
Decision: in fuzzing mode the printer prints `PLit` patterns without noise.
Reason: `(-1) => ...` parses as a one-item tuple pattern, so a noisy variant of `-1 => ...` is a different program. The Python fuzzer has the same latent bug but never hits it because its examples have no negative literal patterns. The canonical printer is unchanged.

## 2026-11-22 — M1: patches are byte-identical to the oracle's
Decision: port CPython's `difflib.SequenceMatcher` (including the autojunk heuristic) and `repr(float)` exactly, and cross-check them against a live python3 in `packages/compiler/test/pycompat.test.ts`.
Reason: the spec only requires codes, lines and columns to match, but agents apply patches mechanically, so the conformance test compares the whole diagnostic JSON, patches included.

## 2026-11-22 — Pin TypeScript 5.9, not the npm `latest` 7.x
Decision: use `typescript@~5.9` across the monorepo.
Reason: npm `latest` is now the native TypeScript 7 port; Next.js 16 and typescript-eslint still target 5.x.

## 2026-11-22 — Work on `main` in a fresh repository
Decision: `git init -b main` and commit each milestone on `main`.
Reason: the folder was not a git repository; the spec asks for one commit per milestone, and there is no remote yet (creating it is an owner step in DEPLOY.md).

## 2026-11-22 — Keep the zip and local Claude settings out of git
Decision: `.gitignore` excludes `canon-v0.zip` and `.claude/settings.local.json`.
Reason: the zip duplicates `reference/`, and local settings are per-machine.
