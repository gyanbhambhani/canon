/**
 * Verify references: each language's reference passes its checker (canon check / mypy --strict /
 * tsc --strict), starts with the seed's declarations, and passes every hidden test. The Canon
 * reference must also pass every test after compiling to Python (THINK's path).
 *
 *   npx tsx --conditions=source scripts/validate-refs.ts [--langs py] [--dir refs] [--tests tests] [ids...]
 */
import { checkCode } from "../arms/check.js";
import { runTests } from "../adapters/exec.js";
import { LANGS, loadRef, loadSeed, loadTests, seedIds, type Lang } from "../lib/seed.js";
import { pyDecls } from "../lib/types.js";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return d;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const langs = opt("langs", LANGS.join(",")).split(",") as Lang[];
const dir = opt("dir", "refs");
const testsDir = opt("tests", "tests");
const ids = argv.length ? argv : seedIds();

let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log(`FAIL ${m}`);
};
for (const id of ids) {
  const seed = loadSeed(id);
  const cases = testsDir === "tests" ? loadTests(id) : (await import("../lib/seed.js")).loadTestsFrom(testsDir, id);
  for (const lang of langs) {
    const src = loadRef(lang, id, dir);
    if (!src) {
      fail(`${id} ${lang}: missing`);
      continue;
    }
    const decls = lang === "canon" ? seed.decls.canon : lang === "ts" ? seed.decls.ts : pyDecls(seed);
    if (decls && !src.startsWith(decls.trim())) fail(`${id} ${lang}: does not start with the seed's declarations`);
    const c = checkCode(lang, src);
    if (!c.ok) {
      fail(`${id} ${lang}: check failed\n${c.feedback.slice(0, 1500)}`);
      continue;
    }
    const r = runTests(lang, src, seed, cases);
    if (r.passed !== r.total) fail(`${id} ${lang}: ${r.passed}/${r.total} ${JSON.stringify(r.firstFail).slice(0, 400)}`);
    if (lang === "canon") {
      const p = runTests("canonpy", src, seed, cases);
      if (p.passed !== p.total) fail(`${id} canon->python: ${p.passed}/${p.total} ${JSON.stringify(p.firstFail).slice(0, 400)}`);
    }
  }
}
console.log(`${ids.length} seeds, langs ${langs.join(",")}: ${failures} failures`);
process.exit(failures ? 1 : 0);
