/**
 * Verify starters and tasks: every reference solution, applied to a fresh copy of its arm's starter,
 * builds, passes the arm's own checks and the hidden suite (HTTP tests + client wiring), and the
 * generator's ground truth holds on its server (base and inside inputs answer 2xx, outside inputs 422).
 * Also records validation agreement (phase 1: references only).
 *
 *   tsx harness/verify.ts [--arms hand,schema,canon] [--out results/references.jsonl] [--concurrency 4] [--no-checks] [ids...]
 *
 * One JSON line per (task, arm). With no ids: the starter (no task) and every task.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ARMS, VA1, build, checks, prepare, type Arm } from "./arms";
import { loadTask, runHidden, type Agreement } from "./hidden";

const argv = process.argv.slice(2);
const flag = (name: string, dflt?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const skipValues = new Set(["--arms", "--out", "--concurrency"]);
const ids = argv.filter((a, i) => !a.startsWith("--") && !skipValues.has(argv[i - 1] ?? ""));
const arms = (flag("arms") ?? ARMS.join(",")).split(",") as Arm[];
const out = flag("out") ? join(VA1, flag("out")!) : null;
const concurrency = Number(flag("concurrency", "4"));
const runChecks = !argv.includes("--no-checks");

export function generatorViolations(a: Agreement): string[] {
  const bad: string[] = [];
  for (const [cat, s] of Object.entries(a.server)) {
    const wantOk = cat === "base" || cat.startsWith("inside:");
    const wantInvalid = cat.startsWith("outside:");
    if (wantOk && s.ok !== s.n) bad.push(`${cat}: ${s.n - s.ok} of ${s.n} not accepted by the server`);
    if (wantInvalid && s.invalid !== s.n) bad.push(`${cat}: ${s.n - s.invalid} of ${s.n} not rejected (422) by the server`);
  }
  return bad;
}

const all = ids.length ? ids : ["(starter)", ...readdirSync(join(VA1, "tasks")).filter((d) => existsSync(join(VA1, "tasks", d, "task.json"))).sort()];
const jobs = all.flatMap((id) => arms.map((arm) => ({ id, arm })));
let next = 0;
let failures = 0;
if (out) mkdirSync(dirname(out), { recursive: true });

async function worker() {
  while (next < jobs.length) {
    const { id, arm } = jobs[next++];
    const task = id === "(starter)" ? null : loadTask(id);
    const dir = prepare(arm, join(VA1, ".work", "verify", id.replace(/[()]/g, ""), arm), task ? [join(VA1, "tasks", id, "reference", arm)] : []);
    const b = build(arm, dir);
    const c = b.ok ? (runChecks ? checks(arm, dir) : { ok: true, steps: [] }) : { ok: false, steps: [b] };
    const h = b.ok ? await runHidden(dir, task) : null;
    const gen = h?.agreement ? generatorViolations(h.agreement) : [];
    const ok = b.ok && c.ok && !!h?.pass && !gen.length && (h?.agreement?.serverOther ?? 0) === 0;
    if (!ok) failures++;
    const a = h?.agreement;
    const line = {
      task: id, set: task?.set ?? null, adapted: task?.adapted ?? null, arm, ok, buildOk: b.ok, checksOk: c.ok,
      httpPass: h?.httpPass ?? false, wiring: h?.wiring ?? null, generatorViolations: gen,
      agreement: a ? a.agree / a.samples : null, bounce: a?.bounce ?? null, block: a?.block ?? null, samples: a?.samples ?? null,
      byCategory: a?.byCategory ?? null, disagreements: a?.disagreements ?? [],
    };
    if (out) appendFileSync(out, JSON.stringify(line) + "\n");
    const failed = h ? h.http.filter((r) => !r.passed).map((r) => `${r.id}: ${r.error ?? ""}`) : [];
    console.log(`${ok ? "PASS" : "FAIL"} ${id} ${arm}${a ? ` agreement ${(a.agree / a.samples).toFixed(3)} (bounce ${a.bounce}, block ${a.block})` : ""}` +
      `${c.ok ? "" : `; checks failed: ${c.steps.filter((s) => !s.ok).map((s) => s.name).join(", ")}`}`);
    for (const f of failed.slice(0, 6)) console.log(`    ${f}`);
    if (h && !h.wiring.ok) console.log(`    wiring: ${h.wiring.error}`);
    for (const g of gen) console.log(`    generator: ${g}`);
    if (a && a.serverOther) console.log(`    server answered neither 2xx nor 422 to ${a.serverOther} inputs`);
    for (const s of c.steps.filter((x) => !x.ok)) console.log(`    [${s.name}] ${s.output.split("\n").slice(0, 8).join("\n    ")}`);
  }
}
if (out && !ids.length) rmSync(out, { force: true });
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(failures ? `${failures} failed` : "all verified");
process.exitCode = failures ? 1 : 0;
void writeFileSync;
