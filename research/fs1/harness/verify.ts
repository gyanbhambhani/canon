/**
 * Verify starters and tasks: every reference solution, applied to a fresh copy of its arm's
 * starter, builds, passes the arm's own checks, and passes all hidden tests (task + regression).
 *   tsx harness/verify.ts                 the starters and every task
 *   tsx harness/verify.ts cancel-order    one task (or several)
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ARMS, FS1, build, checks, prepare } from "./arms";
import { loadTask, runHidden } from "./hidden";

const ids = process.argv.slice(2);
const tasks = ids.length ? ids : ["(starter)", ...readdirSync(join(FS1, "tasks")).filter((d) => existsSync(join(FS1, "tasks", d, "task.json"))).sort()];
let failures = 0;
for (const id of tasks) {
  const task = id === "(starter)" ? null : loadTask(id);
  for (const arm of ARMS) {
    const dir = prepare(arm, join(FS1, ".work", "verify", id.replace(/[()]/g, ""), arm), task ? [join(FS1, "tasks", id, "reference", arm)] : []);
    const b = build(arm, dir);
    const c = b.ok ? checks(arm, dir) : { ok: false, steps: [b] };
    const h = b.ok ? await runHidden(dir, task) : null;
    const ok = b.ok && c.ok && !!h?.pass;
    if (!ok) failures++;
    const failed = h ? h.results.filter((r) => !r.passed).map((r) => `${r.id}: ${r.error ?? ""}`) : [];
    const agreement = h?.validation.map((v) => `${v.feature} ${v.agreement ?? v.error}`).join(", ");
    console.log(`${ok ? "PASS" : "FAIL"} ${id} ${arm}: ${h ? `${h.results.filter((r) => r.passed).length}/${h.results.length} tests` : "not run"}` +
      `${c.ok ? "" : `; checks failed: ${c.steps.filter((s) => !s.ok).map((s) => s.name).join(", ")}`}${agreement ? `; agreement ${agreement}` : ""}`);
    for (const f of failed.slice(0, 8)) console.log(`    ${f}`);
    for (const s of c.steps.filter((x) => !x.ok)) console.log(`    [${s.name}] ${s.output.split("\n").slice(0, 8).join("\n    ")}`);
  }
}
console.log(failures ? `${failures} failed` : "all verified");
process.exitCode = failures ? 1 : 0;
