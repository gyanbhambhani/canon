/**
 * Verify CHANGE items. For each change/<id>.json:
 *   - the updated reference in every language (change/refs/<lang>/<id>.*) passes its checker,
 *     starts with the item's declarations, and passes every new case and every regression case
 *     (change/tests/<id>.json: { cases, regression });
 *   - the ORIGINAL reference (refs/<lang>/<id>.*) fails at least one new case in every language
 *     (so the change is real), when the signature is unchanged; with a changed signature the
 *     original cannot be called on the new cases and this check is skipped.
 *
 *   npx tsx --conditions=source scripts/validate-change.ts [ids...]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runTests } from "../adapters/exec.js";
import { checkCode } from "../arms/check.js";
import { BENCH, EXT, LANGS, loadRef, loadSeed, type Case } from "../lib/seed.js";
import { pyDecls } from "../lib/types.js";

export interface ChangeItem {
  id: string;
  requirement: string;
  fn: string;
  params: [string, string][];
  ret: string;
  desc: string;
  decls: { canon: string; ts: string };
  typeKinds: Record<string, "record" | "sum">;
}

const dir = join(BENCH, "change");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log(`FAIL ${m}`);
};
for (const id of ids) {
  const item: ChangeItem = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
  const t = JSON.parse(readFileSync(join(dir, "tests", `${id}.json`), "utf8")) as { cases: Case[]; regression: Case[] };
  if (t.cases.length < 4) fail(`${id}: fewer than 4 new cases`);
  if (t.regression.length < 3) fail(`${id}: fewer than 3 regression cases`);
  const seed = loadSeed(id);
  const sameSig = JSON.stringify([seed.params, seed.ret]) === JSON.stringify([item.params, item.ret]);
  for (const lang of LANGS) {
    const f = join(dir, "refs", lang, `${id}.${EXT[lang]}`);
    if (!existsSync(f)) {
      fail(`${id} ${lang}: missing ${f}`);
      continue;
    }
    const src = readFileSync(f, "utf8");
    const decls = lang === "canon" ? item.decls.canon : lang === "ts" ? item.decls.ts : pyDecls(item);
    if (decls && !src.startsWith(decls.trim())) fail(`${id} ${lang}: does not start with the item's declarations`);
    const c = checkCode(lang, src);
    if (!c.ok) {
      fail(`${id} ${lang}: check failed\n${c.feedback.slice(0, 1500)}`);
      continue;
    }
    const n = runTests(lang, src, item, t.cases);
    if (n.passed !== n.total) fail(`${id} ${lang}: new cases ${n.passed}/${n.total} ${JSON.stringify(n.firstFail).slice(0, 400)}`);
    const r = runTests(lang, src, item, t.regression);
    if (r.passed !== r.total) fail(`${id} ${lang}: regression ${r.passed}/${r.total} ${JSON.stringify(r.firstFail).slice(0, 400)}`);
    if (sameSig) {
      const orig = loadRef(lang, id)!;
      const o = runTests(lang, orig, seed, t.cases);
      if (o.passed === o.total) fail(`${id} ${lang}: the original reference already passes every new case (the change is not real)`);
    }
  }
}
console.log(`${ids.length} change items: ${failures} failures`);
process.exit(failures ? 1 : 0);
