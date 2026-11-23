/**
 * VA-1 runner: one agent per (task, arm, model, run), the same scaffold, prompt template and budget
 * in every arm. Adapted from research/fs1/runner/run.ts: the agent reads files, writes files and
 * runs `check` and `test`, in a text protocol. After each reply that writes files the harness builds,
 * runs the arm's checks (automatic fixes first) and the visible tests: at most 5 edit rounds and 16
 * replies. Then the hidden suite decides: HTTP tests + client wiring (completed), and validation
 * agreement on 1,000 seeded near-boundary inputs.
 *
 *   npx tsx runner/run.ts --model local:Qwen2.5-Coder-7B-Instruct-8bit --port 8091 --runs 3 --out results/qwen7b.jsonl
 *
 * One JSON line per run; keys already recorded in --out are skipped. Runs are ordered run 1 for all
 * (task, arm) pairs, then run 2, then run 3, so a stopped experiment has complete early runs.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { ARMS, ROOT, VA1, build, checks, listFiles, prepare, type Arm } from "../harness/arms";
import { loadTask, runHidden, type Agreement } from "../harness/hidden";
import { localModel, type Model, type Turn, type Usage } from "./models";

export const MAX_EDIT_ROUNDS = 5;
export const MAX_TURNS = 16;

const arg = (name: string, dflt?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

// ---------------------------------------------------------------- prompts (one template, every arm)

const SCAFFOLD = `You are a software engineer working on a small forms service: a Python backend and a TypeScript frontend. You complete one task: add one endpoint and the frontend feature module that calls it.

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
  hand: `This project: the backend is a hand-written FastAPI app (Python 3.13, Pydantic v2) in backend/ (backend/main.py, backend/errors.py). Raise InvalidRequest(rule) for a rule the request breaks (answered 422). The frontend's fetch client is hand-written in frontend/src/api/client.ts (call, invalid); feature modules are in frontend/src/features/. Checks: ruff (with fixes), mypy --strict, tsc --noEmit and eslint (with fixes).`,
  schema: `This project: the backend is a FastAPI app (Python 3.13, Pydantic v2) in backend/ (backend/main.py, backend/models.py, backend/errors.py). Put every constraint a schema can state in the Pydantic models (Field(min_length=, max_length=, ge=, le=, gt=, lt=, multiple_of=, pattern=), Literal[...]): the server enforces them and FastAPI exports them in its OpenAPI schema. \`node generate-client.mjs\` (run before every check) turns that schema into frontend/src/api/schema.d.ts (types, openapi-typescript 7.13.0) and frontend/src/api/schemas.json, from which frontend/src/api/validate.ts builds validators (ajv 8.17.1): do not edit generated files. frontend/src/api/client.ts has \`send(baseUrl, method, path, modelName, input, extra?)\`, which validates the input against the model's generated validator, then against your \`extra\` function (return a message when invalid; use it for rules a schema cannot state, such as rules over two fields or computed rules, which you must also check in the backend, for example with a Pydantic model_validator), and only then sends. Feature modules are in frontend/src/features/. Checks: ruff (with fixes), mypy --strict, tsc --noEmit and eslint (with fixes).`,
  canon: `This project: the data types, API endpoints and backend logic are written in Canon, in canon/. \`canon build\` generates the FastAPI backend in backend/canon_generated/ and the TypeScript types, validators and client in frontend/src/canon/; it runs before every check. An \`api fn\`'s \`requires:\` is the request validation: the server and the generated client both enforce it. Never edit generated files: change the Canon source. backend/main.py is yours; feature modules are in frontend/src/features/. Checks: canon check (with its patches applied), canon test, tsc --noEmit and eslint (with fixes). The Canon reference and its full-stack addendum follow.`,
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

/** The files an agent edits, shown up front (generated files are listed only). */
function editable(arm: Arm, path: string): boolean {
  if (path.includes("canon_generated/") || path.startsWith("frontend/src/canon/") || path.endsWith("schema.d.ts") || path.endsWith("schemas.json")) return false;
  if (path === "frontend/src/api/validate.ts") return false;
  return /\.(py|ts|cn)$/.test(path) && !path.endsWith(".config.js");
}

function taskText(id: string): string {
  const conv = readFileSync(join(VA1, "tasks", "CONVENTIONS.md"), "utf8").trim();
  return `${readFileSync(join(VA1, "tasks", id, "task.md"), "utf8").trim()}\n\n${conv}`;
}

function firstMessage(arm: Arm, dir: string, id: string): string {
  const files = listFiles(dir);
  const parts = [`# Task\n\n${taskText(id)}`, `# Files\n\n${files.join("\n")}`];
  for (const f of files.filter((x) => editable(arm, x))) parts.push(`<file path="${f}">\n${readFileSync(join(dir, f), "utf8")}</file>`);
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
  const h = await runHidden(dir, null);
  const failed = h.http.filter((r) => !r.passed);
  return `[visible tests] ${h.http.length - failed.length}/${h.http.length} passed` + failed.slice(0, 10).map((r) => `\n  FAIL ${r.id}: ${clip(r.error ?? "", 600)}`).join("");
}

// ---------------------------------------------------------------- one run

export interface RunRecord {
  key: string;
  task: string;
  set: number;
  adapted: boolean;
  arm: Arm;
  model: string;
  run: number;
  /** the gate: every hidden HTTP test and the client wiring check pass */
  pass: boolean;
  httpPass: boolean;
  wiringOk: boolean;
  checksOk: boolean;
  agreement: Agreement | null;
  editRounds: number;
  turns: number;
  finished: "done" | "rounds" | "turns" | "error";
  usage: Usage;
  referenceTokens: number;
  wallMs: number;
  error?: string;
  failures: string[];
  transcript: string;
}

export async function runOne(model: Model, taskId: string, arm: Arm, run: number): Promise<RunRecord> {
  const started = Date.now();
  const task = loadTask(taskId);
  const dir = prepare(arm, join(VA1, ".work", "runs", `${taskId}-${arm}-${model.id.replace(/[^\w.-]/g, "_")}-${run}`));
  const { text: system, referenceChars } = systemPrompt(arm);
  const turns: Turn[] = [{ role: "user", content: firstMessage(arm, dir, taskId) }];
  const usage: Usage = { input: 0, output: 0 };
  let editRounds = 0;
  let finished: RunRecord["finished"] = "turns";
  let error: string | undefined;
  const log: string[] = [];
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await model.chat(system, turns);
      usage.input += reply.usage.input;
      usage.output += reply.usage.output;
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
        feedback.push((await checkReport(arm, dir)).text, await visibleTests(dir), `(${MAX_EDIT_ROUNDS - editRounds} edit rounds left)`);
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
    finished = "error";
    error = e instanceof Error ? e.message : String(e);
  }
  const b = build(arm, dir);
  const c = checks(arm, dir);
  const h = await runHidden(dir, task);
  return {
    key: `${taskId}|${arm}|${model.id}|${run}`,
    task: taskId,
    set: task.set,
    adapted: !!task.adapted,
    arm,
    model: model.id,
    run,
    pass: h.pass,
    httpPass: h.httpPass,
    wiringOk: h.wiring.ok,
    checksOk: b.ok && c.ok,
    agreement: h.agreement,
    editRounds,
    turns: turns.filter((t) => t.role === "assistant").length,
    finished,
    usage,
    referenceTokens: Math.round(referenceChars / 3.5),
    wallMs: Date.now() - started,
    ...(error ? { error } : {}),
    failures: [...h.http.filter((r) => !r.passed).map((r) => `${r.id}: ${(r.error ?? "").slice(0, 300)}`), ...(h.wiring.ok ? [] : [`wiring: ${h.wiring.error}`])],
    transcript: log.join("\n").slice(0, 200_000),
  };
}

// ---------------------------------------------------------------- CLI

if (process.argv[1]?.endsWith("run.ts")) {
  const name = arg("model")!;
  if (!name.startsWith("local:")) throw new Error("VA-1 runs local models only (Amendment 1): paid accounts are out of credit");
  const port = Number(arg("port", "8091"));
  const model = localModel(name.slice(6), port);
  const all = readdirSync(join(VA1, "tasks")).filter((d) => existsSync(join(VA1, "tasks", d, "task.json"))).sort();
  const tasks = (arg("tasks") ?? all.join(",")).split(",");
  const arms = (arg("arms") ?? ARMS.join(",")).split(",") as Arm[];
  const runs = Number(arg("runs", "1"));
  const out = join(VA1, arg("out", "results/qwen7b.jsonl")!);
  mkdirSync(dirname(out), { recursive: true });
  const read = (): RunRecord[] => (existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as RunRecord) : []);
  // an infrastructure failure (the model server failed) is not a result: it is rerun
  const infra = (rec: RunRecord) => rec.finished === "error" && !!rec.error;
  const done = new Set(read().filter((rec) => !infra(rec)).map((rec) => rec.key));
  const jobs: { t: string; arm: Arm; r: number }[] = [];
  for (let r = 1; r <= runs; r++) for (const t of tasks) for (const arm of arms) jobs.push({ t, arm, r });
  for (const { t, arm, r } of jobs) {
    const key = `${t}|${arm}|${model.id}|${r}`;
    if (done.has(key)) continue;
    const rec = await runOne(model, t, arm, r);
    if (infra(rec)) {
      console.log(`INFRA ${key}: ${rec.error?.slice(0, 200)} (not recorded)`);
      continue;
    }
    appendFileSync(out, JSON.stringify(rec) + "\n");
    const a = rec.agreement;
    console.log(`${rec.pass ? "PASS" : "FAIL"} ${key}: rounds ${rec.editRounds}, turns ${rec.turns}, ${rec.finished}, checks ${rec.checksOk ? "ok" : "failed"}` +
      `${a ? `, agreement ${(a.agree / a.samples).toFixed(3)}` : ""}, tokens ${rec.usage.input}/${rec.usage.output}, ${Math.round(rec.wallMs / 1000)}s`);
  }
}
