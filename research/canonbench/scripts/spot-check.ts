/**
 * Draw the owner's 10% spot-check sample per family (plan section 8), at random with a fixed seed,
 * and write it as readable Markdown to spot-check/. The owner reviews it after the run (the
 * approval gate was waived for this overnight run; see DECISIONS.md).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "../lib/gen.js";
import { BENCH, loadRef, loadSeed, loadTests, seedIds } from "../lib/seed.js";

const r = mulberry32(424242);
const sample = <T>(xs: T[], frac = 0.1) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(1, Math.ceil(a.length * frac)));
};
const dir = join(BENCH, "spot-check");
mkdirSync(dir, { recursive: true });
const fence = (lang: string, s: string) => "```" + lang + "\n" + s.trimEnd() + "\n```\n";
const jsonl = (f: string) => readFileSync(join(BENCH, "items", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

// seeds and references (WRITE / THINK)
{
  const L = ["# Spot check: seeds, hidden tests and the three references (10% of 60 seeds)", "", "Check: the spec is unambiguous, the tests match it, and each reference is idiomatic for its language.", ""];
  for (const id of sample(seedIds())) {
    const s = loadSeed(id);
    L.push(`## ${id}`, "", s.desc, "", "Hidden tests:", "", fence("json", loadTests(id).map((c) => JSON.stringify(c)).join("\n")));
    for (const [lang, f] of [["canon", "canon"], ["py", "python"], ["ts", "ts"]]) L.push(`### ${lang}`, "", fence(f, loadRef(lang as "canon", id)!));
  }
  writeFileSync(join(dir, "write-seeds.md"), L.join("\n"));
}
// READ
{
  const items = jsonl("read.jsonl");
  const L = ["# Spot check: READ questions (10%)", "", "Check: the question is answerable from the program, and the recorded answer is right.", ""];
  for (const it of sample(items)) {
    L.push(`## ${it.qid} (${it.type}, basis: ${it.basis})`, "", it.question, "", `Recorded answer: \`${JSON.stringify(it.answer)}\``, "", "Python version shown to the model:", "", fence("python", it.programs.py), "Stripped Canon:", "", fence("canon", it.programs["canon-stripped"]));
  }
  writeFileSync(join(dir, "read.md"), L.join("\n"));
}
// FIX
{
  const items = jsonl("fix.jsonl");
  const L = ["# Spot check: FIX mutants (10%)", "", "Check: the mutant is a plausible bug, and the failing example is right.", ""];
  for (const it of sample(items)) {
    L.push(`## ${it.fid}`, "", `Mutation (${it.mutation}) at line ${it.site.line}: \`${it.site.from}\` -> \`${it.site.to}\``, "", `Failing example: ${JSON.stringify(it.fail)}`, "", fence(it.lang === "py" ? "python" : it.lang, it.broken));
  }
  writeFileSync(join(dir, "fix.md"), L.join("\n"));
}
// CHANGE
{
  const ids = readFileSync(join(BENCH, "items", "change.txt"), "utf8").split("\n").filter(Boolean);
  const L = ["# Spot check: CHANGE items (10%)", "", "Check: the requirement is clear, the new and regression tests match it, and the three updated references are natural edits.", ""];
  for (const id of sample(ids)) {
    const it = JSON.parse(readFileSync(join(BENCH, "change", `${id}.json`), "utf8"));
    const t = readFileSync(join(BENCH, "change", "tests", `${id}.json`), "utf8");
    L.push(`## ${id}`, "", `Requirement: ${it.requirement}`, "", fence("json", t));
    for (const [lang, f, ext] of [["canon", "canon", "cn"], ["py", "python", "py"], ["ts", "ts", "ts"]]) L.push(`### ${lang}`, "", fence(f, readFileSync(join(BENCH, "change", "refs", lang, `${id}.${ext}`), "utf8")));
  }
  writeFileSync(join(dir, "change.md"), L.join("\n"));
}
console.log("spot-check sample written");
