/**
 * CanonBench runner (extends Experiment 1's runner: same draft-then-feedback loop, plus GPT-6.2 Sol,
 * automatic fixes, property testing, READ questions and a dollar cap). One JSON line per run in
 * results/<family>-<model>.jsonl; runs already recorded are skipped, so a crash can be resumed.
 * Infrastructure failures (API errors, timeouts, crashes) are logged to results/errors-*.log and
 * not recorded, so a rerun retries exactly those; wrong answers are recorded and never rerun.
 *
 *   npx tsx --conditions=source runner/run.ts --family write --model qwen7b --langs canon,py,ts \
 *     --seeds all|pilot|<ids> --runs 1 --concurrency 4 [--tag pilot] [--limit N]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { approxEqual, runTests, type TestOutcome } from "../adapters/exec.js";
import { toolchain } from "../arms/check.js";
import { propertyTest } from "../arms/props.js";
import { changePrompt, extractCode, feedbackPrompt, fixPrompt, readPrompt, readSystemPrompt, systemPrompt, writePrompt } from "../arms/prompts.js";
import type { ReadArm, ReadItem } from "../generators/read.js";
import type { FixItem } from "../generators/fix.js";
import { BENCH, EXT, loadRef, loadSeed, loadTests, type Case, type Lang } from "../lib/seed.js";
import type { SigLike } from "../lib/types.js";
import { CapReached, makeModel, type Model, type Turn, type Usage } from "./models.js";

export const MAX_ROUNDS = 3;

export interface LoopRecord {
  key: string;
  family: string;
  model: string;
  arm: string;
  item: string;
  seed: string;
  run: number;
  tag: string;
  /** the checker accepted the model's first program (after automatic fixes) */
  firstCheckOk: boolean;
  /** feedback rounds used (0 to 3) */
  rounds: number;
  /** checker clean and property tests passed at the end: "the arm's checks approve" */
  accepted: boolean;
  /** checker errors on programs as written, summed over every check of the run */
  errorsReported: number;
  /** of those, errors that the automatic fixes removed */
  errorsAutoFixed: number;
  propertyFailures: number;
  tests: TestOutcome | null;
  /** regression tests (CHANGE only) */
  regression?: TestOutcome | null;
  pass: boolean;
  initial: string;
  final: string;
  usage: Usage;
  calls: number;
  ms: number;
}

function addUsage(a: Usage, b: Usage) {
  a.input += b.input;
  a.output += b.output;
  a.cacheRead += b.cacheRead;
  a.cacheWrite += b.cacheWrite;
  a.usd += b.usd;
}
const zero = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 });

/** The shared agent loop: draft, then up to MAX_ROUNDS rounds of toolchain feedback. */
async function loop(model: Model, lang: Lang, prompt: string, sig: SigLike, examples: Case[]) {
  const usage = zero();
  const turns: Turn[] = [{ role: "user", content: prompt }];
  let initial = "";
  let code = "";
  let firstCheckOk = false;
  let rounds = 0;
  let accepted = false;
  let checkerOk = false;
  let errorsReported = 0;
  let errorsAutoFixed = 0;
  let propertyFailures = 0;
  let calls = 0;
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const reply = await model.chat(systemPrompt(lang), turns);
    calls++;
    addUsage(usage, reply.usage);
    const written = extractCode(reply.text, lang);
    const tc = await toolchain(lang, written);
    code = tc.code;
    errorsReported += tc.errorsBefore;
    errorsAutoFixed += Math.max(0, tc.errorsBefore - tc.errors);
    if (round === 0) {
      initial = written;
      firstCheckOk = tc.ok;
    }
    checkerOk = tc.ok;
    let feedback = tc.feedback;
    if (tc.ok) {
      const p = propertyTest(lang, code, sig, examples);
      if (p.ok) {
        accepted = true;
        break;
      }
      propertyFailures++;
      feedback = p.feedback;
    }
    if (round === MAX_ROUNDS) break;
    rounds++;
    turns.push({ role: "assistant", content: reply.text });
    turns.push({ role: "user", content: feedbackPrompt(lang, feedback) });
  }
  return { usage, initial, code, firstCheckOk, rounds, accepted, checkerOk, errorsReported, errorsAutoFixed, propertyFailures, calls };
}

// ---------------------------------------------------------------- jobs

interface Job {
  family: string;
  arm: string;
  item: string;
  seed: string;
  run: number;
  exec(model: Model): Promise<Omit<LoopRecord, "key" | "family" | "model" | "arm" | "item" | "seed" | "run" | "tag" | "ms">>;
}

function writeJob(lang: Lang, id: string, run: number): Job {
  return {
    family: "write",
    arm: lang,
    item: id,
    seed: id,
    run,
    async exec(model) {
      const s = loadSeed(id);
      const l = await loop(model, lang, writePrompt(lang, s), s, s.examples);
      // tested whenever the checker is clean (a property-test failure alone does not block delivery)
      const tests = l.checkerOk ? runTests(lang, l.code, s, loadTests(id)) : null;
      return { ...l, final: l.code, tests, pass: !!tests && tests.passed === tests.total };
    },
  };
}

function fixJob(it: FixItem, run: number): Job {
  return {
    family: "fix",
    arm: it.lang,
    item: it.fid,
    seed: it.seed,
    run,
    async exec(model) {
      const s = loadSeed(it.seed);
      const l = await loop(model, it.lang, fixPrompt(it.lang, s, it.broken, it.fail, it.checkerOutput), s, s.examples);
      const tests = l.checkerOk ? runTests(it.lang, l.code, s, loadTests(it.seed)) : null;
      return { ...l, final: l.code, tests, pass: !!tests && tests.passed === tests.total };
    },
  };
}

interface ChangeItem extends SigLike {
  id: string;
  requirement: string;
  desc: string;
  typeKinds: Record<string, "record" | "sum">;
}

function changeJob(lang: Lang, id: string, run: number): Job {
  return {
    family: "change",
    arm: lang,
    item: id,
    seed: id,
    run,
    async exec(model) {
      const item: ChangeItem = JSON.parse(readFileSync(join(BENCH, "change", `${id}.json`), "utf8"));
      const t = JSON.parse(readFileSync(join(BENCH, "change", "tests", `${id}.json`), "utf8")) as { cases: Case[]; regression: Case[] };
      const l = await loop(model, lang, changePrompt(lang, item, loadRef(lang, id)!, item.requirement), item, []);
      const tests = l.checkerOk ? runTests(lang, l.code, item, t.cases) : null;
      const regression = l.checkerOk ? runTests(lang, l.code, item, t.regression) : null;
      return { ...l, final: l.code, tests, regression, pass: !!tests && !!regression && tests.passed === tests.total && regression.passed === regression.total };
    },
  };
}

export interface ReadRecord {
  key: string;
  family: "read";
  model: string;
  arm: ReadArm;
  item: string;
  seed: string;
  type: string;
  run: number;
  tag: string;
  answer: unknown;
  given: unknown;
  parsed: boolean;
  correct: boolean;
  reply: string;
  usage: Usage;
  ms: number;
}

export function parseAnswer(text: string, kind: ReadItem["kind"]): { ok: boolean; v?: unknown } {
  // the requested "ANSWER: ..." line; failing that (the same leniency in every arm), the last fenced
  // block, then the last non-empty line
  const lines = text.trim().split("\n").filter((l) => /ANSWER:/i.test(l));
  let raw: string;
  if (lines.length) raw = lines[lines.length - 1].replace(/^.*ANSWER:\s*/i, "");
  else {
    const blocks = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)];
    raw = blocks.length ? blocks[blocks.length - 1][1] : (text.trim().split("\n").filter((l) => l.trim()).pop() ?? "");
  }
  raw = raw.trim().replace(/^`+|`+$/g, "").replace(/\.$/, "").replace(/^\*+|\*+$/g, "").trim();
  if (kind === "bool") {
    if (/^(yes|true)\b/i.test(raw)) return { ok: true, v: true };
    if (/^(no|false)\b/i.test(raw)) return { ok: true, v: false };
    return { ok: false };
  }
  try {
    if (kind === "value") raw = raw.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
    const v = JSON.parse(raw);
    return { ok: true, v };
  } catch {
    if (kind === "set" && /^\[.*\]$/.test(raw)) {
      return { ok: true, v: raw.slice(1, -1).split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean) };
    }
    return { ok: false };
  }
}

export function scoreAnswer(kind: ReadItem["kind"], answer: unknown, given: unknown): boolean {
  if (kind === "set") {
    if (!Array.isArray(given)) return false;
    const a = [...new Set((answer as string[]).map(String))].sort();
    const g = [...new Set(given.map(String))].sort();
    return JSON.stringify(a) === JSON.stringify(g);
  }
  if (kind === "bool") return given === answer;
  return approxEqual(given, answer);
}

// ---------------------------------------------------------------- main

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

export const PILOT_SEEDS = ["caesar_shift", "parse_duration", "stack_vm", "invoice_total", "build_order", "max_subarray", "text_editor", "parse_money", "k_most_frequent", "tic_tac_toe"];

async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await f(items[i++]);
  }));
}

async function main() {
  const family = arg("family", "write");
  const modelKey = arg("model", "qwen7b");
  const model = makeModel(modelKey, Number(arg("port", "8091")));
  const langs = arg("langs", family === "read" ? "canon,canon-stripped,py,ts" : "canon,py,ts").split(",");
  const runs = Number(arg("runs", "1"));
  const tag = arg("tag", "main");
  const seedArg = arg("seeds", "all");
  const limit = Number(arg("limit", "0"));
  const concurrency = Number(arg("concurrency", model.api ? "8" : "4"));
  const inSeeds = (seed: string) => seedArg === "all" || (seedArg === "pilot" ? PILOT_SEEDS.includes(seed.replace(/^effects\//, "")) : seedArg.split(",").includes(seed));
  const out = join(BENCH, "results", `${family}-${modelKey}${tag === "main" ? "" : "-" + tag}.jsonl`);
  const errLog = join(BENCH, "results", `errors-${family}-${modelKey}.log`);
  mkdirSync(join(BENCH, "results"), { recursive: true });
  const done = new Set(existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : []);

  type AnyJob = { key: string; go: () => Promise<object> };
  const jobs: AnyJob[] = [];
  const mk = (j: Job) => {
    const key = `${model.key}|${j.family}|${j.arm}|${j.item}|${j.run}`;
    jobs.push({
      key,
      go: async () => {
        const t0 = Date.now();
        const r = await j.exec(model);
        return { key, family: j.family, model: model.id, arm: j.arm, item: j.item, seed: j.seed, run: j.run, tag, ...r, ms: Date.now() - t0 };
      },
    });
  };

  if (family === "read") {
    const items: ReadItem[] = readFileSync(join(BENCH, "items", "read.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    for (let run = 0; run < runs; run++)
      for (const arm of langs as ReadArm[])
        for (const it of items.filter((x) => inSeeds(x.seed))) {
          const key = `${model.key}|read|${arm}|${it.qid}|${run}`;
          jobs.push({
            key,
            go: async () => {
              const t0 = Date.now();
              const reply = await model.chat(readSystemPrompt(arm), [{ role: "user", content: readPrompt(arm, it.programs[arm], it.question, it.answerFormat) }], model.api ? 16000 : 1024);
              const p = parseAnswer(reply.text, it.kind);
              const rec: ReadRecord = {
                key, family: "read", model: model.id, arm, item: it.qid, seed: it.seed, type: it.type, run, tag,
                answer: it.answer, given: p.v ?? null, parsed: p.ok, correct: p.ok && scoreAnswer(it.kind, it.answer, p.v),
                reply: reply.text.slice(-1500), usage: reply.usage, ms: Date.now() - t0,
              };
              return rec;
            },
          });
        }
  } else if (family === "write") {
    const ids = readFileSync(join(BENCH, "items", "write.txt"), "utf8").split("\n").filter(Boolean);
    for (let run = 0; run < runs; run++) for (const l of langs) for (const id of ids.filter(inSeeds)) mk(writeJob(l as Lang, id, run));
  } else if (family === "fix") {
    const items: FixItem[] = readFileSync(join(BENCH, "items", "fix.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    for (let run = 0; run < runs; run++) for (const it of items.filter((x) => inSeeds(x.seed) && langs.includes(x.lang))) mk(fixJob(it, run));
  } else if (family === "change") {
    const ids = readFileSync(join(BENCH, "items", "change.txt"), "utf8").split("\n").filter(Boolean);
    for (let run = 0; run < runs; run++) for (const l of langs) for (const id of ids.filter(inSeeds)) mk(changeJob(l as Lang, id, run));
  }
  let todo = jobs.filter((j) => !done.has(j.key));
  if (limit) todo = todo.slice(0, limit);
  console.log(`${model.id} ${family}: ${todo.length} runs to do (${done.size} already in ${out})`);
  let finished = 0;
  let stop = false;
  await pool(todo, concurrency, async (j) => {
    if (stop) return;
    try {
      const rec = (await j.go()) as Record<string, unknown>;
      appendFileSync(out, JSON.stringify(rec) + "\n");
      finished++;
      const status = family === "read" ? (rec.correct ? "RIGHT" : rec.parsed ? "WRONG" : "UNPARSED") : rec.pass ? "PASS" : rec.accepted ? "FAIL(accepted)" : "FAIL";
      console.log(`[${finished}/${todo.length}] ${j.key} ${status} ${((rec.ms as number) / 1000).toFixed(1)}s`);
    } catch (e) {
      if (e instanceof CapReached) {
        stop = true;
        console.log(`STOP: ${e.message}`);
        appendFileSync(errLog, `${new Date().toISOString()} ${j.key} CAP ${e.message}\n`);
        return;
      }
      appendFileSync(errLog, `${new Date().toISOString()} ${j.key} ${String((e as Error)?.message ?? e).slice(0, 300)}\n`);
      console.log(`ERROR ${j.key}: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export { EXT };
