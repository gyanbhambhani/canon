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
