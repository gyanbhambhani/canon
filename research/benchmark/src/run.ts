/**
 * Run the benchmark. Each run: the model writes the program, the checker answers (canon check
 * JSON with patches, or tsc errors), the model fixes, up to MAX_FIX_ROUNDS; then the task's
 * hidden tests run. One JSON line per run goes to results/runs.jsonl; runs already there are skipped.
 *
 *   pnpm bench --models anthropic,openai --tasks all --runs 10 --concurrency 6
 *   pnpm bench --tasks sum_evens,grade --runs 1          (a dry run)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractCode, LANGUAGES, type Language } from "./languages.js";
import { anthropicProvider, openaiProvider, type Provider, type Turn, type Usage } from "./providers.js";
import { TASKS, type Task } from "./tasks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
export const RESULTS = join(HERE, "..", "results", process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "runs.jsonl");
export const MAX_FIX_ROUNDS = 3;

/** $ per million tokens. OpenAI prices are not published to this harness; cost is left null. */
export const PRICES: Record<string, { input: number; cachedInput: number; cacheWrite: number; output: number } | null> = {
  "claude-opus-5-5": { input: 4, cachedInput: 0.2, cacheWrite: 5, output: 20 },
  "gpt-6.2-sol": null,
};

export interface RunRecord {
  key: string;
  provider: string;
  model: string;
  servedBy: string[];
  fallback: boolean;
  lang: string;
  task: string;
  run: number;
  firstPassOk: boolean;
  fixRounds: number;
  finalOk: boolean;
  firstCodes: string[];
  initial: string;
  final: string;
  normalized: string;
  tests: { passed: number; total: number; error?: string };
  usage: Usage;
  cost: number | null;
  ms: number;
  error?: string;
}

function loadEnv() {
  const f = join(ROOT, ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

export function costOf(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (u.input * p.input + u.cachedInput * p.cachedInput + u.cacheWrite * p.cacheWrite + u.output * p.output) / 1e6;
}

async function runOne(provider: Provider, lang: Language, task: Task, run: number): Promise<RunRecord> {
  const started = Date.now();
  const usage: Usage = { input: 0, cachedInput: 0, cacheWrite: 0, output: 0 };
  const servedBy = new Set<string>();
  let fallback = false;
  const turns: Turn[] = [{ role: "user", content: lang.prompt(task) }];
  let initial = "";
  let code = "";
  let firstPassOk = false;
  let firstCodes: string[] = [];
  let fixRounds = 0;
  let ok = false;
  for (let round = 0; round <= MAX_FIX_ROUNDS; round++) {
    const reply = await provider.chat(lang.system, turns);
    for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += reply.usage[k];
    servedBy.add(reply.servedBy);
    fallback ||= reply.fallback;
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
  return {
    key: `${provider.model}|${lang.id}|${task.id}|${run}`,
    provider: provider.id,
    model: provider.model,
    servedBy: [...servedBy],
    fallback,
    lang: lang.id,
    task: task.id,
    run,
    firstPassOk,
    fixRounds,
    finalOk: ok,
    firstCodes,
    initial,
    final: code,
    normalized: await lang.normalize(code),
    tests: ok ? lang.test(code, task) : { passed: 0, total: task.tests.length, error: "never checked clean" },
    usage,
    cost: costOf(provider.model, usage),
    ms: Date.now() - started,
  };
}

async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await f(items[i++]);
  }));
}

async function main() {
  loadEnv();
  const providers: Provider[] = arg("models", "anthropic,openai").split(",").map((m) =>
    m === "anthropic" ? anthropicProvider() : m === "openai" ? openaiProvider() : (() => { throw new Error(`unknown model ${m}`); })());
  const langs = arg("langs", "canon,typescript").split(",").map((l) => LANGUAGES[l as keyof typeof LANGUAGES]);
  const taskArg = arg("tasks", "all");
  const tasks = taskArg === "all" ? TASKS : TASKS.filter((t) => taskArg.split(",").includes(t.id));
  const runs = Number(arg("runs", "10"));
  const concurrency = Number(arg("concurrency", "6"));

  mkdirSync(dirname(RESULTS), { recursive: true });
  const done = new Set(existsSync(RESULTS) ? readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : []);
  const jobs = providers.flatMap((p) => langs.flatMap((l) => tasks.flatMap((t) => Array.from({ length: runs }, (_, r) => ({ p, l, t, r })))))
    .filter((j) => !done.has(`${j.p.model}|${j.l.id}|${j.t.id}|${j.r}`));
  console.log(`${jobs.length} runs to do (${done.size} already recorded)`);

  let finished = 0;
  let spent = 0;
  const budget = Number(arg("budget", "30"));
  await pool(jobs, concurrency, async ({ p, l, t, r }) => {
    if (spent >= budget) {
      finished++;
      return; // budget reached: leave the rest unrecorded so a later run resumes them
    }
    try {
      const rec = await runOne(p, l, t, r);
      appendFileSync(RESULTS, JSON.stringify(rec) + "\n");
      spent += rec.cost ?? 0;
      finished++;
      console.log(
        `[${finished}/${jobs.length}] ${p.model} ${l.id} ${t.id}#${r}: first=${rec.firstPassOk ? "ok" : rec.firstCodes.slice(0, 3).join(",")} ` +
          `fixes=${rec.fixRounds} tests=${rec.tests.passed}/${rec.tests.total} ${(rec.ms / 1000).toFixed(1)}s` +
          (rec.cost !== null ? ` $${rec.cost.toFixed(4)}` : ""),
      );
    } catch (e) {
      finished++;
      console.log(`[${finished}/${jobs.length}] ${p.model} ${l.id} ${t.id}#${r}: ERROR ${(e as Error).message.slice(0, 200)}`);
    }
  });
  console.log(`done. Claude spend this session: $${spent.toFixed(2)}${spent >= budget ? ` (stopped at the $${budget} budget)` : ""}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
