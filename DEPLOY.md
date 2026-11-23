# Deploying Canon

These steps need the owner's accounts, so the build stops short of them. Do them in order.
Everything else (tests, the web build, the CLI bundle) already runs in CI.

## 1. Create the GitHub repository

Done: <https://github.com/gyanbhambhani/canon> (public, MIT).
For a fresh fork, create an empty repository on GitHub and keep its URL.

## 2. Push

Done: `main` is pushed, and CI (`.github/workflows/ci.yml`) runs on every push.
For a fresh repository:

```bash
git remote add origin git@github.com:OWNER/canon.git
git push -u origin main
```

Then check the Actions tab: the run includes the oracle self-test, lint, type-check, all tests,
the web build and the Playwright smoke test, and must be green.

## 3. Set NEXT_PUBLIC_GITHUB_URL

Done: set on the Vercel project `canon` for Production, Preview and Development.

The landing page's GitHub button and the GitHub icon in the site navigation read this variable
at build time and are hidden when it is unset. Set it in the Vercel project (next step), for
Production and Preview:

```
NEXT_PUBLIC_GITHUB_URL=https://github.com/gyanbhambhani/canon
```

To try it locally: `NEXT_PUBLIC_GITHUB_URL=https://github.com/gyanbhambhani/canon pnpm --filter web build`.

## 4. Import apps/web into Vercel

Done: Vercel project `canon` (team "gyan"), Root Directory `apps/web`, connected to the GitHub
repository so every push to `main` deploys. Live at <https://canon-lake.vercel.app>.

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Set **Root Directory** to `apps/web`. Leave "Include files outside the root directory" on
   (the build compiles `packages/*`).
3. Framework preset: **Next.js**. Keep the default install command; Vercel detects the pnpm
   workspace from `pnpm-lock.yaml`. Build command: `pnpm build` (the default `build` script
   builds the compiler and runtime, runs `scripts/stats.ts`, then `next build`).
4. Add `NEXT_PUBLIC_GITHUB_URL` from step 3.
5. Deploy. The site is fully static (`output: "export"`): `/`, `/docs/*`, `/play` and `/llms.txt`.
   Node 20 or later is required; Vercel's default is fine.
6. Optional: add a custom domain under **Settings → Domains**.

## 5. Publish canon-lang to npm

Done: `canon-lang@0.1.0` is on npm (<https://www.npmjs.com/package/canon-lang>), published from the
`gyanb` account. Accounts with a passkey publish interactively: npm prints a link to approve.
Publish the `pnpm pack` tarball so `workspace:*` references are rewritten:
`pnpm pack --pack-destination /tmp && npm publish /tmp/canon-lang-X.Y.Z.tgz --access public --auth-type=web`.

The CLI is one self-contained bundle (`packages/cli/dist/index.js`, no runtime dependencies),
published as `canon-lang` with the binary `canon`. The name was free on npm when this file was
written.

```bash
npm login                      # the owner's npm account
pnpm install
pnpm test                      # builds everything and runs the suite
cd packages/cli
npm publish --access public    # publishes canon-lang@0.1.0
```

Afterwards, `npx canon-lang run hello.cn` (or `npm i -g canon-lang` and then `canon run hello.cn`)
works anywhere with Node 20 or later. Bump `version` in every package.json together for later releases.

## 6. Set the GitHub repository's About

The owner sets this by hand on GitHub (the gear next to **About**):

- Description: `The programming language for AI agents. Typed, compiled, fits in a prompt. Every error ships with its fix.`
- Website: `https://canon-lake.vercel.app`
- Topics: `programming-language`, `ai-agents`, `compiler`, `llm`, `typescript`, `developer-tools`

## 7. Publish canon-lang 0.1.1

0.1.1 changes only the npm listing: the description above, `homepage`, `repository`, `bugs` and
`keywords`, and the `exports` map no longer names `src/main.ts`, which is not shipped. Publish it
the same way as step 5:

```bash
pnpm test
cd packages/cli
pnpm pack --pack-destination /tmp
npm publish /tmp/canon-lang-0.1.1.tgz --access public --auth-type=web
```

## 8. Publish canon-lang 0.3.0 (language v0.3)

0.3.0 ships language and toolchain v0.3: `&&`, `||` and `!`; `break`; `for (i, x) in`; formatter line
wrapping; `canon check --fix`; contract fuzzing in `canon test`; sealed effects (E103, effect-checked
tests) and the run-time capability guard; T001 fix suggestions; and a `--no-<feature>` / `--v0.2`
switch for every change. The npm version now tracks the language version.

```bash
cd ~/Desktop/canon/packages/cli
pnpm pack --pack-destination /tmp      # writes /tmp/canon-lang-0.3.0.tgz with workspace:* rewritten
npm publish /tmp/canon-lang-0.3.0.tgz --access public --auth-type=web
```

## 9. Publish canon-lang 0.4.0 (language v0.4)

0.4.0 ships language and toolchain v0.4: effects on function types (T011; `--no-fn-effects`), the
opt-in Canon-Py syntax (`--syntax py`; brace syntax stays the default until Experiment 1 compares
them), `canon build` (a standalone JavaScript file, or `--module`), `--watch` on check, test, run
and build, and `--v0.3`. The tarball includes `dist/runtime-standalone.js`, which `canon build`
inlines.

```bash
cd ~/Desktop/canon
pnpm build
cd packages/cli
pnpm pack --pack-destination /tmp      # writes /tmp/canon-lang-0.4.0.tgz with workspace:* rewritten
tar -tzf /tmp/canon-lang-0.4.0.tgz | grep runtime-standalone.js
npm publish /tmp/canon-lang-0.4.0.tgz --access public --auth-type=web
```

## 10. Publish canon-lang 0.4.1 (v0.4 fixes)

0.4.1 fixes six issues from the v0.4 review (DECISIONS.md): `to_float` fixes never keep an integer
division's truncation, the chained-comparison hint names `&&`, text output lists T001 suggestions,
`canon test` reports and counts fuzz skips, long pipeline stages wrap, and Canon-Py programs print
`True`, `None` and `Item(sku="a")`.

```bash
cd ~/Desktop/canon
pnpm build
cd packages/cli
pnpm pack --pack-destination /tmp      # writes /tmp/canon-lang-0.4.1.tgz with workspace:* rewritten
npm publish /tmp/canon-lang-0.4.1.tgz --access public --auth-type=web
```

## 11. Publish canon-lang 0.5.0 (v0.5, full-stack)

0.5.0 adds project modules, `api fn`, tables, `store(...)` and `net(...)` effects, the FastAPI and
TypeScript-client generators, `canon build` from canon.toml, `canon dev`, `canon manifest` and drift
protection (G001). It also fixes the problems the benchmarks found in the Python target (CB-1, CB-2,
forward-referenced model fields, a function named like its module). The language and the checks for
single files are unchanged; see the changelog page for what to watch when upgrading (the `get`,
`save`, `count`, `insert`, `delete`, `scan` and `next_id` built-ins exist only in programs with a
table; `use` takes names; canonical form now breaks long contracts, so `canon fmt --write` may change
a file that has a contract over 100 characters).

Before publishing, from a clean checkout of main, in order:

```bash
cd ~/Desktop/canon
pnpm install --frozen-lockfile
pnpm pyenv                            # the pinned Python tools the generated-code tests use
pnpm test && pnpm lint && pnpm typecheck
pnpm --filter web build && pnpm e2e && pnpm e2e:examples
```

Then, in this order (the site and the package should go out together, since the docs now describe 0.5):

1. Push main: `git push origin main`, and tag it: `git tag v0.5.0 && git push origin v0.5.0`.
2. Publish the package (the packed tarball was already installed in an empty folder and run:
   `canon --version`, `check`, `build` into 11 files, `manifest`):

   ```bash
   cd ~/Desktop/canon
   pnpm build
   cd packages/cli
   pnpm pack --pack-destination /tmp      # writes /tmp/canon-lang-0.5.0.tgz with workspace:* rewritten
   npm publish /tmp/canon-lang-0.5.0.tgz --access public --auth-type=web
   ```

3. Let Vercel redeploy `apps/web` from the pushed main (it also serves `/changelog`,
   `/llms-fullstack.txt` and the new docs pages).
4. In the changelog page's source, flip the version label from "0.5.0, unreleased" to "0.5.0".
5. Check: `npx canon-lang@0.5.0 --version` prints `canon 0.5.0`.

What is not part of the release: the frontier-model reruns for CanonBench, Experiment FS-1 and
Experiment VA-1 (the API accounts ran out of credit). Their reports say what is missing; the
changelog says so too.
