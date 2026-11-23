/**
 * FS-1 runner: one agent per (task, arm, model, run), with the same scaffold, prompt template and
 * budget in every arm. The agent reads files, writes files and runs allowed commands, in a text
 * protocol every model can follow. After each reply that writes files, the harness builds, runs
 * the arm's own checks (fixes applied automatically) and the visible tests, and shows the results:
 * at most 5 such edit-and-check rounds. Then the hidden suite decides the run.
 *
 *   npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks cancel-order \
 *     --arms direct,openapi,canon --runs 1 --out results/smoke.jsonl
 *   (--model local:Qwen2.5-Coder-7B-Instruct-8bit --port 8097 for a local model)
 *
 * One JSON line per run; runs already recorded in --out are skipped.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { ARMS, FS1, ROOT, build, checks, listFiles, prepare, type Arm } from "../harness/arms";
import { loadTask, runHidden, type HiddenReport } from "../harness/hidden";
import { claudeModel, dollars, gptModel, loadEnv, localModel, type Model, type Turn, type Usage } from "./models";

export const MAX_EDIT_ROUNDS = 5;
export const MAX_TURNS = 16;

const arg = (name: string, dflt?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

// ---------------------------------------------------------------- prompts (one template, every arm)

const SCAFFOLD = `You are a software engineer working on a small online shop (products, users, orders): a Python backend and a TypeScript frontend. You complete one task.

Act only through these actions, written exactly like this, any number per reply:
<read path="relative/path"/>             show a file
<write path="relative/path">
...the complete new contents of the file...
</write>                                  create or replace a whole file
<run>check</run>                          run the project's checks (automatic fixes are applied first)
<run>test</run>                           run the visible tests
<done/>                                   you are finished

After every reply that writes files, the project is built and checked and the visible tests run, and you see the results. You have at most ${MAX_EDIT_ROUNDS} such edit rounds, and ${MAX_TURNS} replies in all. Always write whole files. Keep any explanation to at most three lines. When the task is complete and the checks pass, reply <done/>.`;

const ARM_TEXT: Record<Arm, string> = {
  direct: `This project: the backend is a hand-written FastAPI app (Python 3.13, Pydantic v2) in backend/ (backend/main.py, backend/shop/). The frontend's API types and fetch client are hand-written in frontend/src/api/; feature modules are in frontend/src/features/. Checks: ruff (with fixes), mypy --strict, tsc --noEmit and eslint (with fixes).`,
  openapi: `This project: the backend is a hand-written FastAPI app (Python 3.13, Pydantic v2) in backend/ (backend/main.py, backend/shop/). The frontend's API types are generated from the backend's OpenAPI schema into frontend/src/api/schema.d.ts by \`node generate-client.mjs\`, which runs before every check; do not edit schema.d.ts. frontend/src/api/client.ts wraps openapi-fetch; feature modules are in frontend/src/features/. Checks: ruff (with fixes), mypy --strict, tsc --noEmit and eslint (with fixes).`,
  canon: `This project: the data types, API endpoints and backend logic are written in Canon, in canon/. \`canon build\` generates the FastAPI backend in backend/canon_generated/ and the TypeScript types, validators and client in frontend/src/canon/; it runs before every check. Never edit generated files: change the Canon source. backend/main.py is yours; feature modules are in frontend/src/features/. Checks: canon check (with its patches applied), canon test, tsc --noEmit and eslint (with fixes). The Canon reference and its full-stack addendum follow.`,
};

function reference(file: string, mdx: string): string {
  const built = join(ROOT, "apps", "web", "out", file);
  if (existsSync(built)) return readFileSync(built, "utf8");
  return readFileSync(join(ROOT, "apps", "web", "content", "docs", mdx), "utf8").replace(/^---[\s\S]*?---\n/, "");
}

export function systemPrompt(arm: Arm): { text: string; referenceChars: number } {
  let text = `${SCAFFOLD}\n\n${ARM_TEXT[arm]}`;
  let referenceChars = 0;
  if (arm === "canon") {
    const core = reference("llms.txt", "for-agents.mdx");
    const addendum = reference("llms-fullstack.txt", "for-agents-fullstack.mdx");
    referenceChars = core.length + addendum.length;
    text += `\n\n=== Canon reference ===\n${core}\n\n=== Canon full-stack addendum ===\n${addendum}`;
  }
  return { text, referenceChars };
}

/** The files an agent edits, shown up front (generated files and the generated schema are listed only). */
function editable(arm: Arm, path: string): boolean {
  if (path.includes("canon_generated/") || path.startsWith("frontend/src/canon/") || path.endsWith("schema.d.ts")) return false;
  if (arm === "canon" && path.startsWith("backend/") && path !== "backend/main.py") return false;
  return /\.(py|ts|cn)$/.test(path) && !path.endsWith(".config.js");
}

function firstMessage(arm: Arm, dir: string, taskMd: string): string {
  const files = listFiles(dir);
  const shown = files.filter((f) => editable(arm, f));
  const parts = [`# Task\n\n${taskMd.trim()}`, `# Files\n\n${files.join("\n")}`];
  for (const f of shown) parts.push(`<file path="${f}">\n${readFileSync(join(dir, f), "utf8")}</file>`);
  return parts.join("\n\n");
}

// ---------------------------------------------------------------- the protocol

interface Action {
  kind: "read" | "write" | "run" | "done";
  path?: string;
  body?: string;
}

export function parseActions(text: string): Action[] {
  const out: { at: number; a: Action }[] = [];
  for (const m of text.matchAll(/<read\s+path="([^"]+)"\s*\/>/g)) out.push({ at: m.index!, a: { kind: "read", path: m[1] } });
  for (const m of text.matchAll(/<write\s+path="([^"]+)"\s*>\n?([\s\S]*?)<\/write>/g)) {
    let body = m[2];
    // a model may wrap the file in a code fence
    const fence = /^\s*```[\w-]*\n([\s\S]*?)\n```\s*$/.exec(body);
    if (fence) body = fence[1] + "\n";
    out.push({ at: m.index!, a: { kind: "write", path: m[1], body } });
  }
  for (const m of text.matchAll(/<run>\s*(\w+)\s*<\/run>/g)) out.push({ at: m.index!, a: { kind: "run", body: m[1] } });
  for (const m of text.matchAll(/<done\s*\/>/g)) out.push({ at: m.index!, a: { kind: "done" } });
  return out.sort((x, y) => x.at - y.at).map((x) => x.a);
}

function safePath(dir: string, p: string): string | null {
  const n = normalize(p).replace(/^\/+/, "");
  if (n.startsWith("..") || p.startsWith("/") || n.includes("\0")) return null;
  return join(dir, n);
}

const clip = (s: string, n = 3000) => (s.length > n ? s.slice(0, n) + `\n[... ${s.length - n} more characters]` : s);

async function checkReport(arm: Arm, dir: string): Promise<{ text: string; ok: boolean }> {
  const b = build(arm, dir);
  const parts: string[] = [];
  if (!b.ok) parts.push(`[${b.name}] FAILED\n${clip(b.output)}`);
  const c = checks(arm, dir);
  for (const s of c.steps) parts.push(`[${s.name}] ${s.ok ? "ok" : `FAILED\n${clip(s.output)}`}`);
  return { text: parts.join("\n\n"), ok: b.ok && c.ok };
}

async function visibleTests(dir: string): Promise<string> {
  const h = await runHidden(dir, null); // the regression suite is the visible suite
  const failed = h.results.filter((r) => !r.passed);
  return `[visible tests] ${h.results.length - failed.length}/${h.results.length} passed` +
    failed.slice(0, 10).map((r) => `\n  FAIL ${r.id}: ${clip(r.error ?? "", 600)}`).join("");
}

// ---------------------------------------------------------------- one run

/** The provider account has no credit: an infrastructure failure, never recorded. */
export class CreditError extends Error {}

export interface RunRecord {
  key: string;
  task: string;
  kind: string;
  arm: Arm;
  model: string;
  run: number;
  /** every hidden test passed (task + regression) */
  pass: boolean;
  /** a boundary probe failed */
  mismatch: boolean;
  regressionFailures: number;
  taskFailures: number;
  validation: HiddenReport["validation"];
  /** the arm's own checks passed at the end */
  checksOk: boolean;
  /** the arm's checks passed but a hidden test failed */
  falseAcceptance: boolean;
  editRounds: number;
  turns: number;
  finished: "done" | "rounds" | "turns" | "error";
  usage: Usage;
  /** Canon reference and addendum, in characters ÷ 3.5 (the repo's token estimate); 0 in other arms */
  referenceTokens: number;
  dollars: number | null;
  wallMs: number;
  error?: string;
  failures: string[];
  /** the hidden suite's verdict on the state after the first edit round (null: no edit round) */
  firstRound: { pass: boolean; mismatch: boolean } | null;
  transcript: string;
}

export async function runOne(model: Model, taskId: string, arm: Arm, run: number): Promise<RunRecord> {
  const started = Date.now();
  const task = loadTask(taskId);
  const dir = prepare(arm, join(FS1, ".work", "runs", `${taskId}-${arm}-${model.id.replace(/[^\w.-]/g, "_")}-${run}`));
  const { text: system, referenceChars } = systemPrompt(arm);
  const turns: Turn[] = [{ role: "user", content: firstMessage(arm, dir, readFileSync(join(FS1, "tasks", taskId, "task.md"), "utf8")) }];
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let editRounds = 0;
  let firstRound: RunRecord["firstRound"] = null;
  let finished: RunRecord["finished"] = "turns";
  let error: string | undefined;
  const log: string[] = [];
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await model.chat(system, turns);
      for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += reply.usage[k];
      turns.push({ role: "assistant", content: reply.text || "(empty reply)" });
      log.push(`--- assistant ${turn + 1}\n${reply.text}`);
      const actions = parseActions(reply.text);
      const feedback: string[] = [];
      let wrote = false;
      let done = false;
      for (const a of actions) {
        if (a.kind === "done") done = true;
        else if (a.kind === "read") {
          const p = a.path ? safePath(dir, a.path) : null;
          feedback.push(p && existsSync(p) ? `<file path="${a.path}">\n${clip(readFileSync(p, "utf8"), 20000)}</file>` : `[read ${a.path}] no such file`);
        } else if (a.kind === "write") {
          const p = a.path ? safePath(dir, a.path) : null;
          if (!p) {
            feedback.push(`[write ${a.path}] refused: paths are relative to the project root`);
            continue;
          }
          mkdirSync(dirname(p), { recursive: true });
          writeFileSync(p, a.body ?? "");
          wrote = true;
          feedback.push(`[write ${a.path}] saved`);
        } else if (a.kind === "run") {
          if (a.body === "check") feedback.push((await checkReport(arm, dir)).text);
          else if (a.body === "test") feedback.push(await visibleTests(dir));
          else feedback.push(`[run ${a.body}] not allowed: the commands are check and test`);
        }
      }
      if (wrote) {
        editRounds++;
        const report = await checkReport(arm, dir);
        if (editRounds === 1) {
          // first-round pass: the hidden verdict on the first edit round's state (after its build)
          const h1 = await runHidden(dir, task);
          firstRound = { pass: h1.pass, mismatch: h1.mismatch };
        }
        feedback.push(report.text, await visibleTests(dir));
        feedback.push(`(${MAX_EDIT_ROUNDS - editRounds} edit rounds left)`);
      }
      if (done) {
        finished = "done";
        break;
      }
      if (editRounds >= MAX_EDIT_ROUNDS) {
        finished = "rounds";
        break;
      }
      if (!actions.length) feedback.push("No actions found. Use <read .../>, <write ...>...</write>, <run>check</run>, <run>test</run> or <done/>.");
      const msg = feedback.join("\n\n");
      turns.push({ role: "user", content: msg });
      log.push(`--- harness\n${clip(msg, 4000)}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // the account is out of credit: no run happened; record nothing, so it resumes cleanly
    if (/credit balance is too low/i.test(message)) throw new CreditError(message);
    finished = "error";
    error = message;
  }
  // the verdict: build, the arm's checks, the hidden suite
  const b = build(arm, dir);
  const c = checks(arm, dir);
  const h = await runHidden(dir, task);
  const checksOk = b.ok && c.ok;
  return {
    key: `${taskId}|${arm}|${model.id}|${run}`,
    task: taskId,
    kind: task.kind,
    arm,
    model: model.id,
    run,
    pass: h.pass,
    mismatch: h.mismatch,
    regressionFailures: h.regressionFailures,
    taskFailures: h.taskFailures,
    validation: h.validation.map(({ feature, agreement, samples, error: e }) => ({ feature, agreement, samples, error: e })),
    checksOk,
    falseAcceptance: checksOk && !h.pass,
    editRounds,
    turns: turns.filter((t) => t.role === "assistant").length,
    finished,
    usage,
    referenceTokens: Math.round(referenceChars / 3.5),
    dollars: dollars(model, usage),
    wallMs: Date.now() - started,
    ...(error ? { error } : {}),
    failures: h.results.filter((r) => !r.passed).map((r) => `${r.id}: ${(r.error ?? "").slice(0, 300)}`),
    firstRound,
    transcript: log.join("\n").slice(0, 200_000),
  };
}

// ---------------------------------------------------------------- CLI

if (process.argv[1]?.endsWith("run.ts")) {
  loadEnv();
  const name = arg("model")!;
  const model = name.startsWith("local:") ? localModel(name.slice(6), Number(arg("port", "8097")))
    : name.startsWith("claude") ? claudeModel(name) : gptModel(name);
  const tasks = arg("tasks")!.split(",");
  const arms = (arg("arms") ?? ARMS.join(",")).split(",") as Arm[];
  const runs = Number(arg("runs", "1"));
  const firstRun = Number(arg("first-run", "1"));
  const concurrency = Number(arg("concurrency", "1"));
  /** stop launching runs once this model's recorded dollars across --spent files reach the cap */
  const cap = Number(arg("cap", "0"));
  const out = join(FS1, arg("out", "results/runs.jsonl")!);
  const spentFiles = (arg("spent") ?? arg("out", "results/runs.jsonl")!).split(",").map((f) => join(FS1, f));
  mkdirSync(dirname(out), { recursive: true });
  const read = (f: string): RunRecord[] =>
    existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as RunRecord) : [];
  // an infrastructure failure (the model API failed, not a refusal) is not done: it is rerun
  const infra = (rec: RunRecord) => rec.finished === "error" && !!rec.error && !/^refusal/.test(rec.error);
  const done = new Set(read(out).filter((rec) => !infra(rec)).map((rec) => rec.key));
  const spent = () => spentFiles.flatMap(read).filter((rec) => rec.model === model.id).reduce((a, rec) => a + (rec.dollars ?? 0), 0);
  const jobs: { t: string; arm: Arm; r: number }[] = [];
  for (let r = firstRun; r < firstRun + runs; r++) for (const t of tasks) for (const arm of arms) jobs.push({ t, arm, r });
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (next < jobs.length && !stopped) {
      const { t, arm, r } = jobs[next++];
      const key = `${t}|${arm}|${model.id}|${r}`;
      if (done.has(key)) continue;
      if (cap > 0 && spent() >= cap) {
        stopped = true;
        console.log(`STOP: ${model.id} reached the cap of $${cap}`);
        break;
      }
      let rec: RunRecord;
      try {
        rec = await runOne(model, t, arm, r);
      } catch (e) {
        if (!(e instanceof CreditError)) throw e;
        stopped = true;
        console.log(`STOP: ${model.id}: the provider account is out of credit (nothing recorded for ${key})`);
        break;
      }
      appendFileSync(out, JSON.stringify(rec) + "\n");
      console.log(`${rec.pass ? "PASS" : "FAIL"} ${key}: rounds ${rec.editRounds}, turns ${rec.turns}, ${rec.finished}, checks ${rec.checksOk ? "ok" : "failed"}` +
        `${rec.mismatch ? ", MISMATCH" : ""}, tokens ${rec.usage.input + rec.usage.cacheRead + rec.usage.cacheWrite}/${rec.usage.output}` +
        `${rec.dollars !== null ? `, $${rec.dollars.toFixed(3)}` : ""}, ${Math.round(rec.wallMs / 1000)}s${rec.error ? `, error: ${rec.error.slice(0, 200)}` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
