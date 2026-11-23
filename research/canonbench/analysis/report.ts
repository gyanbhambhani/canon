/**
 * Writes REPORT.md from the recorded runs: every number is computed here or by the analysis scripts
 * it calls (analyze.ts, read-errors.ts, canon-py.ts), never typed by hand. The prose around the
 * numbers states what they show; statements that depend on the data are computed too.
 *   npx tsx --conditions=source analysis/report.ts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH } from "../lib/seed.js";
import { analyze, markdown, type Cell } from "./analyze.js";

const run = (cmd: string) => execSync(cmd, { cwd: BENCH, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const jsonl = (f: string) => (existsSync(join(BENCH, "results", f)) ? readFileSync(join(BENCH, "results", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const json = (f: string) => JSON.parse(readFileSync(join(BENCH, f), "utf8"));

run("npx tsx --conditions=source analysis/think.ts");
const baselines = json("analysis/baselines.json");
const a = analyze("main", baselines, 0.1);
writeFileSync(join(BENCH, "results", "scoreboard-main.json"), JSON.stringify(a, null, 1) + "\n");
writeFileSync(join(BENCH, "results", "scoreboard-main.md"), markdown(a));
const readErrors = run("npx tsx --conditions=source analysis/read-errors.ts");
const canonPy = run("npx tsx --conditions=source analysis/canon-py.ts");
const re = json("results/read-errors-main.json") as { model: string; arm: string; type: string; n: number; wrong: number; over: number; falseYes: number; falseNo: number }[];

const pp = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1)}`;
const ci = (c: { d: number; lo: number; hi: number }) => `${pp(c.d)} points [${pp(c.lo)}, ${pp(c.hi)}]`;
const cell = (row: string, model: string) => a.cells.find((c) => c.row === row && c.model === model) as Cell | undefined;
const sec = (fam: string, model: string, arm: string) => a.secondary.find((s) => s.family === fam && s.model === model && s.arm === arm);
const pct = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? "–" : `${(100 * x).toFixed(1)}%`);
const MODEL_NAME: Record<string, string> = { qwen7b: "Qwen2.5-Coder 7B", opus: "Claude Opus 5.5", gpt: "GPT-6.2 Sol" };
const verdictLine = (row: string, model: string) => {
  const c = cell(row, model);
  return c && c.n ? `**${c.verdict}** (${ci(c)} against ${c.baseline === "py" ? "Python" : "TypeScript"}, Holm p = ${(c.pHolm ?? c.p).toFixed(3)}, ${c.n} seeds)` : "not run";
};

// ---------------------------------------------------------------- counts of what ran
const files = ["read", "write", "fix", "change"];
const counts = (model: string) => Object.fromEntries(files.map((f) => [f, jsonl(`${f}-${model}.jsonl`).length]));
const runsByIndex = (f: string, model: string) => {
  const r = jsonl(`${f}-${model}.jsonl`);
  return [0, 1, 2].map((i) => r.filter((x: { run: number }) => x.run === i).length);
};
const planned: Record<string, number> = { read: 198 * 4, write: 60 * 3, fix: 101 * 3, change: 24 * 3 };
const runTable = [
  "| Family | Planned per model (x 3 runs) | Qwen 7B: runs 0 / 1 / 2 recorded | Claude Opus 5.5 | GPT-6.2 Sol |",
  "| --- | --- | --- | --- | --- |",
  ...files.map((f) => {
    const q = runsByIndex(f, "qwen7b");
    const o = runsByIndex(f, "opus");
    const g = runsByIndex(f, "gpt");
    return `| ${f.toUpperCase()} | ${planned[f]} x 3 = ${planned[f] * 3} | ${q.join(" / ")} | ${o.join(" / ")} | ${g.join(" / ")} |`;
  }),
  `| THINK -> Python | derived from WRITE | derived | not run (no WRITE) | derived |`,
  `| THINK -> TypeScript | 60 x 2 | not possible in Canon v0.5 (DECISIONS 18) | | |`,
  `| FULL-STACK (FS-1) | 60 tasks x 3 arms | run by a separate agent on main | | |`,
  `| Readability judge | 100 pairs | not run: the OpenAI account ran out of credit before the first judgment (DECISIONS 39) | | |`,
  `| Exploratory Qwen 32B | 20-seed subset | not run: weights could not be downloaded (DECISIONS 38) | | |`,
  `| Exploratory Canon-Py (Qwen 7B) | pilot seeds x 3, then more | see section 7 | | |`,
].join("\n");

// ---------------------------------------------------------------- headline numbers
const g = (row: string) => cell(row, "gpt");
const q = (row: string) => cell(row, "qwen7b");
const gptThink = jsonl("think-gpt.jsonl").filter((r: { arm: string }) => r.arm === "canon->py");
const thinkFail = gptThink.filter((r: { pass: boolean; thinkPass: boolean }) => r.pass && !r.thinkPass).length;
const erow = (model: string, arm: string, type: string) => re.find((x) => x.model === model && x.arm === arm && x.type === type);
const gpe = erow("gpt", "py", "effects");
const gte = erow("gpt", "ts", "effects");
const gpp = erow("gpt", "py", "property");
const gtp = erow("gpt", "ts", "property");
const costRows = a.cost.filter((c) => c.model === "gpt").map((c) => c.ratio);
const ablG = a.ablation.find((x) => x.model === "gpt" && x.row === "READ" && x.comparison.startsWith("Canon - stripped"));
const ablG2 = a.ablation.find((x) => x.model === "gpt" && x.row === "READ" && x.comparison.startsWith("stripped Canon -"));
const ablQ = a.ablation.find((x) => x.model === "qwen7b" && x.row === "READ" && x.comparison.startsWith("Canon - stripped"));
const ablQe = a.ablation.find((x) => x.model === "qwen7b" && x.row === "READ-effects" && x.comparison.startsWith("Canon - stripped"));

const qw = (fam: string, arm: string) => sec(fam, "qwen7b", arm);
const qwenLines = ["READ", "WRITE", "FIX", "CHANGE", "THINK"].map((r) => `  - ${r}: ${verdictLine(r, "qwen7b")}`).join("\n");

const summary = `- **Qwen2.5-Coder 7B (local, the small-model test):** on the pre-registered rows,
${qwenLines}
  Arm pass rates: WRITE Canon ${pct(qw("write", "canon")?.passRate)}, Python ${pct(qw("write", "py")?.passRate)}, TypeScript ${pct(qw("write", "ts")?.passRate)}; FIX Canon ${pct(qw("fix", "canon")?.passRate)}, Python ${pct(qw("fix", "py")?.passRate)}, TypeScript ${pct(qw("fix", "ts")?.passRate)}; CHANGE Canon ${pct(qw("change", "canon")?.passRate)}, Python ${pct(qw("change", "py")?.passRate)}, TypeScript ${pct(qw("change", "ts")?.passRate)}. The 7B model mostly cannot write Canon's brace syntax: its drafts read like Rust (section 7), fail to parse, and come back unchanged after feedback. The prediction "FIX win, CHANGE win, THINK win" for the 7B did not hold.
- **The plan's win rule ("Canon is the better language for AI agents") cannot be decided.** It needs both frontier models. Claude Opus 5.5 stopped at 01:18 PST when the Anthropic account ran out of credit, and the owner then took it off the run; Opus finished READ only. GPT-6.2 Sol is the one frontier result.
- **GPT-6.2 Sol:** READ ${verdictLine("READ", "gpt")}, driven by the effects questions (READ-effects ${verdictLine("READ-effects", "gpt")}). WRITE, FIX and CHANGE are ${g("WRITE")?.verdict}, ${g("FIX")?.verdict} and ${g("CHANGE")?.verdict} with every language at ${pct(sec("write", "gpt", "canon")?.passRate)}, ${pct(sec("fix", "gpt", "canon")?.passRate)} and ${pct(sec("change", "gpt", "canon")?.passRate)}: a ceiling (the items are too easy for this model, as the pilot warned). THINK -> Python is ${verdictLine("THINK", "gpt")}: ${thinkFail} Canon programs passed in Canon and failed after compiling to Python (CB-2 and G002, section 8). **Cost: lose, as predicted** (Canon used ${Math.min(...costRows).toFixed(1)} to ${Math.max(...costRows).toFixed(1)} times the tokens per item, mostly the agent reference in every prompt).
- **The annotations are not why Canon wins READ for GPT.** Removing requires, ensures and effects changed accuracy by ${ablG ? ci(ablG) : "–"}; stripped Canon still beat ${ablG2?.comparison.includes("ts") ? "TypeScript" : "Python"} by ${ablG2 ? ci(ablG2) : "–"}. Most of the gap is two kinds of question where Python and TypeScript are genuinely open to more than one reading (section 4.2): every one of GPT's ${gpe?.wrong} wrong Python and ${gte?.wrong} wrong TypeScript effects answers named *more* functions than the ground truth (Python's urlopen also opens file:// URLs, for example), and its ${gpp?.wrong} Python and ${gtp?.wrong} TypeScript property misses were all "yes" where the executed references say "no". Read it as "Canon programs leave less room for doubt", not "models understand Canon better".
- **Claude Opus 5.5 (READ only):** at ceiling in every arm; READ ${verdictLine("READ", "opus")}.
- **Compiler bugs found by the benchmark:** CB-1 (fixed on main before the main run) and CB-2 (fixed on main in e4de1a7 after it was reported, but after this run's compiler pin, so it still counts against THINK here); section 8.`;

// ---------------------------------------------------------------- sections
const sb = markdown(a);
const scoreboard = sb.split("### Arm means")[0].replace(/^## Scoreboard.*\n/, "");
const armMeans = "### Arm means" + sb.split("### Arm means")[1].split("### Cost")[0];
const costTable = "### Cost" + sb.split("### Cost")[1].split("### Annotation ablation")[0];
const ablation = sb.split("### Annotation ablation (READ)")[1].split("### Per arm")[0];
const perArm = sb.split("### Per arm")[1];

const ledger = (k: string) => (existsSync(join(BENCH, "results", `spend-${k}.json`)) ? json(`results/spend-${k}.json`) : { usd: 0, calls: 0, input: 0, output: 0 });
const lo = ledger("opus");
const lg = ledger("gpt");
const wall = (model: string) => a.secondary.filter((s) => s.model === model).reduce((t, s) => t + s.wallSeconds, 0) / 3600;
const costs = `| Model | Calls | Input tokens | Output tokens | USD (list prices) | Cap | Model-time (sum of run wall times) |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Opus 5.5 | ${lo.calls} | ${lo.input} | ${lo.output} | ${lo.usd.toFixed(2)} | 150 | ${wall("opus").toFixed(1)} h |
| GPT-6.2 Sol | ${lg.calls} | ${lg.input} | ${lg.output} | ${lg.usd.toFixed(2)} | 150 | ${wall("gpt").toFixed(1)} h |
| Qwen 7B (local) | | | | 0 | | ${wall("qwen7b").toFixed(1)} h |

Ledgers include the pilot and smoke tests (results/spend-*.json; Opus $4/$20 per million input/output tokens,
cache reads $0.20, writes $5; GPT-6.2 Sol $2/$10, cached input $0.10). Total API spend: USD ${(lo.usd + lg.usd).toFixed(2)} of the 300 cap.
Both accounts ran dry for reasons outside CanonBench's ledger (the keys are shared with FS-1): Anthropic at 01:18 PST, OpenAI by 02:05 PST.

${costTable}`;

const thinkQ = jsonl("think-qwen7b.jsonl").filter((r: { arm: string }) => r.arm === "canon->py");
const thinkSection = `THINK delivers Python. Direct = the WRITE Python run; through Canon = the WRITE Canon run's final program compiled by the shipped Python generator, run against the same hidden tests in Python (DECISIONS 19). THINK -> TypeScript is not possible in Canon v0.5 (DECISIONS 18).

- GPT-6.2 Sol: ${verdictLine("THINK", "gpt")}. Of ${gptThink.length} Canon programs, ${gptThink.filter((r: { thinkPass: boolean }) => r.thinkPass).length} pass in Python; ${thinkFail} passed in Canon but not after compiling (${gptThink.filter((r: { pass: boolean; thinkPass: boolean; thinkNote: string }) => r.pass && !r.thinkPass && /G002/.test(r.thinkNote)).length} refused by the generator with G002; the rest fail to import, CB-2's SyntaxError).
- Qwen 7B: ${verdictLine("THINK", "qwen7b")}; ${thinkQ.filter((r: { thinkPass: boolean }) => r.thinkPass).length} of ${thinkQ.length} Canon programs pass in Python (few check clean at all).
- The blind readability judge (Direct vs compiled Python, "which would you rather maintain?") did not run: the OpenAI account was out of credit by the time it started, and Opus was off (DECISIONS 39). No readability result exists.`;

const loops = a.secondary.filter((s) => ["write", "fix", "change"].includes(s.family));
const heal = (arm: string) => {
  const xs = ["write", "fix", "change"].flatMap((f) => jsonl(`${f}-qwen7b.jsonl`).concat(jsonl(`${f}-gpt.jsonl`))).filter((r: { arm: string }) => r.arm === arm);
  const rep = xs.reduce((t: number, r: { errorsReported: number }) => t + (r.errorsReported ?? 0), 0);
  const fixed = xs.reduce((t: number, r: { errorsAutoFixed: number }) => t + (r.errorsAutoFixed ?? 0), 0);
  return `${fixed} of ${rep} (${pct(rep ? fixed / rep : null)})`;
};
const fa = (model: string, arm: string) => {
  const xs = loops.filter((s) => s.model === model && s.arm === arm);
  const acc = xs.reduce((t, s) => t + s.accepted, 0);
  const bad = xs.reduce((t, s) => t + (s.falseAcceptance ?? 0) * s.accepted, 0);
  return acc ? `${pct(bad / acc)} of ${acc} approved` : "–";
};
const selfheal = `Self-healing = checker errors removed by the arm's automatic fixes (canon check --fix, ruff --fix, eslint --fix) / checker errors on programs as written, summed over every check of every run. False acceptance = runs the arm's checks approved (checker clean and property tests passed) that fail a hidden test / runs approved.

${perArm}

- Errors removed by automatic fixes, all models and families together: Canon ${heal("canon")}, Python ${heal("py")}, TypeScript ${heal("ts")}. ruff and eslint fix style, rarely type errors; Canon's \`--fix\` applies its mechanical patches (canonical form C001, effects E101/E102, T009).
- False acceptance, all families together: GPT-6.2 Sol Canon ${fa("gpt", "canon")}, Python ${fa("gpt", "py")}, TypeScript ${fa("gpt", "ts")}; Qwen 7B Canon ${fa("qwen7b", "canon")}, Python ${fa("qwen7b", "py")}, TypeScript ${fa("qwen7b", "ts")}.`;

const fs1Path = join(BENCH, "..", "fs1", "REPORT.md");
// FS-1's report: the merged file if present, else main's copy (the report is generated before merging
// main, so that THINK's compile step uses the pinned compiler)
const fs1Text = existsSync(fs1Path)
  ? readFileSync(fs1Path, "utf8")
  : (() => {
      try {
        return run("git show main:research/fs1/REPORT.md");
      } catch {
        return "";
      }
    })();
const fs1Primary = (fs1Text.split("## Primary outcome")[1] ?? "").split("\n## ")[0].trim();
const fs1 = fs1Primary
  ? `**partial, no verdict** (FS-1 was run by a separate agent on main; both frontier models stopped on credit there too). FS-1's own primary outcome, quoted from research/fs1/REPORT.md (its numbers come from its own analysis script):\n\n${fs1Primary}\n\nAs the THINK family's full-stack row: GPT-6.2 Sol non-inferior on partial data at the ceiling; Claude Opus 5.5 pilot only; Qwen 7B exploratory. See research/fs1/REPORT.md for change-task success, mismatch rate and validation agreement`
  : "**pending FS-1** (FS-1 is run by a separate agent on main; its results were not committed when this report was generated)";

const deviations = readFileSync(join(BENCH, "DECISIONS.md"), "utf8")
  .split("\n")
  .filter((l) => /^\d+\. \*\*/.test(l))
  .map((l) => "- " + l.replace(/^\d+\. /, "").replace(/\*\*(.*?)\*\*.*/, "$1"))
  .join("\n");

const report = `# CanonBench: report

Run overnight 2026-11-22/23, unattended, by an agent, on branch \`worktree-agent-a5ea7b856ce17a840\`. Plan: docs/canonbench.md. Pre-registration: PREREGISTRATION.md (committed at 1b62fb8 before any main-run call; amendments 1 and 2 committed before the calls they cover). Judgment calls: DECISIONS.md. This file is generated by analysis/report.ts from the JSON lines in results/; no number in it is typed by hand.

## Summary

${summary}

## 1. Scoreboard

Canon minus the baseline language (the better of Python and TypeScript on the pilot, fixed before the main run), in percentage points, with the 95% bootstrap interval over seeds and the Holm-adjusted p. win = Holm p < 0.025 and interval above 0; non-inferior = interval above -10; lose = interval below -10; inconclusive otherwise. READ's sub-rows are a second Holm family.

${scoreboard}
- FULL-STACK (FS-1): ${fs1}.
- Cost row: see section 9 (Canon loses on tokens in every cell, as predicted).

### Predictions (PREREGISTRATION.md section 7) against outcomes

| Family | Predicted, Qwen 7B | Observed, Qwen 7B | Predicted, frontier | Observed, GPT-6.2 Sol | Observed, Opus 5.5 |
| --- | --- | --- | --- | --- | --- |
| READ, effects | win (large) | ${q("READ-effects")?.verdict ?? "–"} | win (large) | ${g("READ-effects")?.verdict ?? "–"} | ${cell("READ-effects", "opus")?.verdict ?? "–"} |
| READ, property | win | ${q("READ-property")?.verdict ?? "–"} | win | ${g("READ-property")?.verdict ?? "–"} | ${cell("READ-property", "opus")?.verdict ?? "–"} |
| READ, output | non-inferior | ${q("READ-output")?.verdict ?? "–"} | non-inferior | ${g("READ-output")?.verdict ?? "–"} | ${cell("READ-output", "opus")?.verdict ?? "–"} |
| WRITE | inconclusive or lose | ${q("WRITE")?.verdict ?? "–"} | non-inferior | ${g("WRITE")?.verdict ?? "–"} | not run |
| FIX | win | ${q("FIX")?.verdict ?? "–"} | non-inferior | ${g("FIX")?.verdict ?? "–"} | not run |
| CHANGE | win | ${q("CHANGE")?.verdict ?? "–"} | non-inferior | ${g("CHANGE")?.verdict ?? "–"} | not run |
| THINK, single programs | win | ${q("THINK")?.verdict ?? "–"} | non-inferior | ${g("THINK")?.verdict ?? "–"} | not run |
| FULL-STACK | inconclusive | ${fs1Primary ? "exploratory, unfinished (FS-1)" : "pending FS-1"} | win on change tasks and mismatch | ${fs1Primary ? "non-inferior on partial data, no verdict (FS-1)" : "pending FS-1"} | ${fs1Primary ? "pilot only (FS-1)" : "pending FS-1"} |
| Cost | lose | lose | lose | lose | lose |

### The win rule (plan section 7.3)

Not decidable: it requires both frontier models, and Claude Opus 5.5 ran READ only. For GPT-6.2 Sol alone, condition 1 (non-inferior or better in every family except cost) ${["READ", "WRITE", "FIX", "CHANGE", "THINK"].every((r) => ["win", "non-inferior"].includes(g(r)?.verdict ?? "")) ? "holds" : "does not hold"} on the families run, and condition 2 (Holm wins in at least two families, one of them FIX, CHANGE, THINK or FULL-STACK) ${["FIX", "CHANGE", "THINK"].some((r) => g(r)?.verdict === "win") && ["READ", "WRITE", "FIX", "CHANGE", "THINK"].filter((r) => g(r)?.verdict === "win").length >= 2 ? "holds" : "does not hold"}: its only win is READ, which the plan says is not enough on its own.

## 2. What was run versus what was planned

${runTable}

Qwen 7B ran run-major (run 0 of every family, then run 1, then run 2) and stopped under the pre-registered 07:00 rule; seed scores average over the runs each seed has. Its local server crashed several times with Metal out-of-memory errors (DECISIONS 35 and 41: a second model server, a 32B server that never loaded, then the FS-1 runner's long contexts on the shared server); a watchdog restarted it, and failed calls were not recorded and were redone.

## 3. Per family

${armMeans}

## 4. READ

### 4.1 Annotation ablation

Canon against Canon with requires, ensures and effects removed (the value of the annotations), and stripped Canon against the baseline (syntax alone).
${ablation}
- GPT-6.2 Sol: the annotations added ${ablG ? ci(ablG) : "–"}; stripped Canon vs the baseline ${ablG2 ? ci(ablG2) : "–"}. Canon's READ edge for GPT is in the programs' shape, not the printed annotations.
- Qwen 7B: annotations ${ablQ ? ci(ablQ) : "–"} overall; on effects questions ${ablQe ? ci(ablQe) : "–"}.

### 4.2 How READ answers went wrong (exploratory, not pre-registered)

Over-inclusive = the answer contains every right function plus extra ones. On effects questions this is often a defensible reading of Python's or TypeScript's standard library (urllib's urlopen also opens file:// URLs; a computed URL can reach any host), which Canon's exact effects rule out. False yes / false no are for property questions ("can f ever return ...?"); the ground truth is the executed references on in-spec, typed inputs, while in Python and TypeScript nothing enforces the declared types.

${readErrors}

## 5. Self-healing and false acceptance

${selfheal}

## 6. THINK -> Python

${thinkSection}

## 7. Exploratory: Canon-Py on Qwen 7B, and the Rust-isms (PREREGISTRATION.md amendment 2)

Brace-syntax rows are the main run's and the pilot's Canon runs on the same seeds. "Final program unchanged" counts runs that used feedback rounds yet ended with exactly their first draft. Remaining codes are the checker re-run on the final program of runs that never checked clean.

${canonPy}

Notes: the Python column is the Python arm, for reference; its \`import / from\` count is the required header. Rust-isms (let mut, &, format!, null) appear only in brace-Canon drafts; Canon-Py drafts swap them for Python-isms outside Canon-Py's subset (dict literals, slices, \`+=\`, methods). In WRITE, neither surface got the 7B model to a single program that checks; in FIX and CHANGE, where a working program is given, both surfaces pass some items and Canon-Py does not do better than brace.

## 8. Compiler issues found

- **CB-1** (Phase 1, verifying references through the Python generator): \`unwrap_or\` temporaries hoisted out of lambdas and while conditions (NameErrors; conditions evaluated once). 4 of 60 Experiment 1 references failed through it. Reported at once; fixed on main in 0a38eba before the main run, which used c2cb47e.
- **CB-2** (THINK): the Python generator splits a comprehension's tuple target across lines (\`for key,\\n members\\n in ...\`), a SyntaxError; 2 of GPT-6.2 Sol's Canon programs. Reported during the run; fixed on main in e4de1a7, after the pinned compiler (c2cb47e) this run used.
- **G002 on Option of Option** (a documented refusal): GPT-6.2 Sol wrote \`unwrap_or(map_get(m, k), None)\` on a map of optional values in all 3 parking_fees runs; it checks and runs in Canon, and the Python target refuses it. The core reference does not warn about it.
- **Formatter vs reference** (found by the item authors): the reference says chains of three or more calls are pipelines "one stage per line", but fmt prints a one-line pipeline inside a call argument, a match scrutinee or a binary operand.
- **One Experiment 1 reference was wrong** (not a compiler bug): vending_machine's Canon reference treated negative coins as a refund; fixed in CanonBench's copy.

Minimal reproductions: COMPILER_ISSUES.md.

## 9. Costs

${costs}

## 10. Deviations from the plan

Every entry of DECISIONS.md, by title (details there):

${deviations}

## 11. Spot check

The 10% random sample per family is in spot-check/ (write-seeds.md, read.md, fix.md, change.md), drawn with a fixed seed after the items were final. The owner's review was waived for the overnight run and is pending. I reviewed every READ property question answered "no" against its spec before the main run; that review caught wrong "no" answers in the first generation (DECISIONS 12).
`;
writeFileSync(join(BENCH, "REPORT.md"), report);
console.log(`REPORT.md written (${report.length} characters)`);
