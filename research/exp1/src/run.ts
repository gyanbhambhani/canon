/**
 * Experiment 1 runner: does Canon's compiler loop help weaker models? Three setups with the same
 * budget (a draft plus at most MAX_FIX_ROUNDS fixes), then the task's hidden tests:
 *   py-plain  Python, `mypy --strict` errors (the main rival)
 *   py-patch  Python, the same errors as JSON with patches (mypy suggestions, ruff fixes)
 *   ts-plain  TypeScript, plain `tsc --strict` errors
 *   ts-patch  TypeScript, the same errors as JSON with quick-fix patches (src/ts-patches.ts)
 *   canon     Canon, `canon check` JSON with patches
 * Local models are served by `mlx_lm.server` (OpenAI-compatible); Claude models use the Anthropic SDK.
 * One JSON line per run; runs already recorded are skipped.
 *
 *   npx tsx --conditions=source src/run.ts --model local:Qwen2.5-Coder-7B-Instruct-8bit --port 8081 \
 *     --setups ts-plain,ts-patch,canon --tasks all --runs 5 --out runs.jsonl
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { canon, extractCode, typescript, type CheckOutcome, type Language, type TestOutcome } from "../../benchmark/src/languages.js";
import type { Task } from "../../benchmark/src/tasks.js";
import { pyPatch } from "./py-patches.js";
import { python } from "./python.js";
import { checkWithPatches } from "./ts-patches.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
export const MAX_FIX_ROUNDS = 3;

// ---------------------------------------------------------------- setups

const tsPatch: Language = {
  ...typescript,
  id: "typescript",
  system:
    typescript.system +
    " Compiler errors come back as JSON; an error that has a `fix` carries a unified-diff patch, and applying that patch fixes it.",
  check(code: string): CheckOutcome {
    const diags = checkWithPatches(code);
    return {
      ok: diags.length === 0,
      feedback: diags.length ? `tsc --strict main.ts --json\n${JSON.stringify(diags, null, 2)}` : "",
      codes: diags.map((d) => d.code),
    };
  },
};

export const SETUPS: Record<string, Language> = { "py-plain": python, "py-patch": pyPatch, "ts-plain": typescript, "ts-patch": tsPatch, canon };

// ---------------------------------------------------------------- models

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface Usage {
  input: number;
  output: number;
}
interface Model {
  id: string;
  chat(system: string, turns: Turn[]): Promise<{ text: string; usage: Usage }>;
}

function loadEnv() {
  const f = join(ROOT, ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** A local MLX model behind mlx_lm.server. Sampling follows Qwen2.5-Coder's recommended settings. */
function localModel(name: string, port: number): Model {
  const client = new OpenAI({ baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "local", maxRetries: 3, timeout: 600_000 });
  return {
    id: name,
    async chat(system, turns) {
      const res = await client.chat.completions.create({
        model: `mlx-community/${name}`,
        messages: [{ role: "system", content: system }, ...turns],
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 2048,
      });
      return {
        text: res.choices[0]?.message?.content ?? "",
        usage: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

/** A Claude model. Server-side refusal fallbacks only where the model supports them. */
function claudeModel(model: string): Model {
  const client = new Anthropic({ maxRetries: 8 });
  const withFallback = model !== "claude-haiku-5-5";
  return {
    id: model,
    async chat(system, turns) {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: turns,
      });
      if (res.stop_reason === "refusal") throw new Error(`refusal: ${JSON.stringify(res.stop_details)}`);
      return {
        text: res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
        usage: {
          input: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
          output: res.usage.output_tokens,
        },
      };
    },
  };
}

// ---------------------------------------------------------------- one run

export interface Exp1Record {
  key: string;
  model: string;
  setup: string;
  task: string;
  run: number;
  firstPassOk: boolean;
  fixRounds: number;
  finalOk: boolean;
  firstCodes: string[];
  tests: TestOutcome;
  /** checks clean and every hidden test passes */
  pass: boolean;
  /** checks clean, never crashes, but returns at least one wrong answer */
  silent: boolean;
  initial: string;
  final: string;
  usage: Usage;
  ms: number;
}

async function runOne(model: Model, setup: string, task: Task, run: number): Promise<Exp1Record> {
  const lang = SETUPS[setup];
  const started = Date.now();
  const usage: Usage = { input: 0, output: 0 };
  const turns: Turn[] = [{ role: "user", content: lang.prompt(task) }];
  let initial = "";
  let code = "";
  let firstPassOk = false;
  let firstCodes: string[] = [];
  let fixRounds = 0;
  let ok = false;
  for (let round = 0; round <= MAX_FIX_ROUNDS; round++) {
    const reply = await model.chat(lang.system, turns);
    usage.input += reply.usage.input;
    usage.output += reply.usage.output;
    code = extractCode(reply.text, lang.fence);
    const c = lang.check(code);
    if (round === 0) {
      initial = code;
      firstPassOk = c.ok;
      firstCodes = c.codes;
    }
    if (c.ok) {
      ok = true;
      break;
    }
    if (round === MAX_FIX_ROUNDS) break;
    fixRounds++;
    turns.push({ role: "assistant", content: reply.text });
    turns.push({
      role: "user",
      content: `${c.feedback}\n\nFix the program. Reply with the complete corrected program in one \`\`\`${lang.fence.split("|")[0]} code block.`,
    });
  }
  const tests: TestOutcome = ok ? lang.test(code, task) : { passed: 0, total: task.tests.length, error: "never checked clean" };
  const pass = ok && tests.passed === tests.total;
  const silent = ok && !pass && (tests.crashed ?? 0) === 0 && (tests.wrong ?? 0) > 0;
  return {
    key: `${model.id}|${setup}|${task.id}|${run}`,
    model: model.id,
    setup,
    task: task.id,
    run,
    firstPassOk,
    fixRounds,
    finalOk: ok,
    firstCodes,
    tests,
    pass,
    silent,
    initial,
    final: code,
    usage,
    ms: Date.now() - started,
  };
}

// ---------------------------------------------------------------- main

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await f(items[i++]);
  }));
}

async function main() {
  loadEnv();
  const { HARD_TASKS } = await import("./tasks.js");
  const spec = arg("model", "local:Qwen2.5-Coder-7B-Instruct-8bit");
  const model = spec.startsWith("local:") ? localModel(spec.slice(6), Number(arg("port", "8081"))) : claudeModel(spec);
  const setups = arg("setups", "py-plain,py-patch,ts-plain,ts-patch,canon").split(",");
  const taskArg = arg("tasks", "all");
  const tasks: Task[] = taskArg === "all" ? HARD_TASKS : HARD_TASKS.filter((t: Task) => taskArg.split(",").includes(t.id));
  const runs = Number(arg("runs", "5"));
  const concurrency = Number(arg("concurrency", spec.startsWith("local:") ? "1" : "6"));
  const out = join(HERE, "..", "results", arg("out", "runs.jsonl"));

  mkdirSync(dirname(out), { recursive: true });
  const done = new Set(existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : []);
  const jobs = setups.flatMap((s) => tasks.flatMap((t) => Array.from({ length: runs }, (_, r) => ({ s, t, r }))))
    .filter((j) => !done.has(`${model.id}|${j.s}|${j.t.id}|${j.r}`));
  console.log(`${model.id}: ${jobs.length} runs to do (${done.size} already in ${out})`);

  let finished = 0;
  await pool(jobs, concurrency, async ({ s, t, r }) => {
    try {
      const rec = await runOne(model, s, t, r);
      appendFileSync(out, JSON.stringify(rec) + "\n");
      finished++;
      console.log(
        `[${finished}/${jobs.length}] ${s} ${t.id}#${r}: ${rec.pass ? "PASS" : rec.silent ? "SILENT" : rec.finalOk ? "FAIL" : "NO-CHECK"} ` +
          `first=${rec.firstPassOk ? "ok" : rec.firstCodes.slice(0, 3).join(",")} fixes=${rec.fixRounds} tests=${rec.tests.passed}/${rec.tests.total} ${(rec.ms / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      finished++;
      console.log(`[${finished}/${jobs.length}] ${s} ${t.id}#${r}: ERROR ${(e as Error).message.slice(0, 200)}`);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
