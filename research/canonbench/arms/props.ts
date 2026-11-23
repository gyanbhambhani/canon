/**
 * The property-testing step of each toolchain, run once a program checks clean. A failure is
 * shown to the model like a checker error and costs a round, in every arm.
 *   canon  `canon test` contract fuzzing (fuzzContracts): pure functions with requires/ensures
 *   py     Hypothesis on functions that contain `assert` (sandbox/py_props.py)
 *   ts     random inputs from the signature's types (a dependency-free stand-in for fast-check, which
 *          is not in the pinned lockfile) on the target function, when the module contains assertions
 *          (`assert(`, `console.assert(` or `throw new Error("assert...`); an error that mentions an
 *          assertion is a failure
 * Inputs are drawn from types (and, for TypeScript, the two shown examples), never from hidden tests.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, execute, VENV, type SigInfo } from "../adapters/exec.js";
import { InputGen, mulberry32 } from "../lib/gen.js";
import { BENCH, type Case, type Lang } from "../lib/seed.js";

export interface PropOutcome {
  ok: boolean;
  feedback: string;
  ran: boolean;
}

const NONE: PropOutcome = { ok: true, feedback: "", ran: false };

export function propertyTest(lang: Lang, code: string, sig: SigInfo & { decls?: { canon: string; ts: string } }, examples: Case[]): PropOutcome {
  try {
    if (lang === "canon") {
      if (!/^\s*(requires|ensures):/m.test(code)) return NONE;
      const c = compile("canon", code);
      if (!c.ok) return NONE;
      const r = spawnSync(process.execPath, ["--max-old-space-size=768", join(BENCH, "sandbox", "js-runner.mjs")], {
        input: JSON.stringify({ mode: "fuzz", js: c.artifact, tries: 100 }),
        encoding: "utf8",
        timeout: 30_000,
        cwd: BENCH,
      });
      const fails = JSON.parse(r.stdout || "[]") as { name: string; args?: string[]; trap?: { code?: string; message?: string } }[];
      if (!fails.length) return { ok: true, feedback: "", ran: true };
      return {
        ok: false,
        ran: true,
        feedback: `canon test main.cn --json (contract fuzzing)\n${JSON.stringify(fails.map((f) => ({ test: f.name, counterexample: f.args, trap: f.trap })), null, 2)}`,
      };
    }
    if (lang === "py") {
      if (!/^\s*assert\b/m.test(code)) return NONE;
      const dir = mkdtempSync(join(tmpdir(), "cb-prop-"));
      try {
        writeFileSync(join(dir, "main.py"), code);
        const r = spawnSync(join(VENV, "python"), ["-I", join(BENCH, "sandbox", "py_props.py")], {
          input: JSON.stringify({ path: dir, examples: 100 }),
          encoding: "utf8",
          timeout: 60_000,
          cwd: dir,
        });
        const line = (r.stdout ?? "").trim().split("\n").pop() ?? "[]";
        const fails = JSON.parse(line || "[]") as { fn: string; args: string; error: string }[];
        if (!fails.length) return { ok: true, feedback: "", ran: true };
        return { ok: false, ran: true, feedback: `hypothesis (property tests on asserting functions)\n${JSON.stringify(fails, null, 2)}` };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    if (!/\bassert\s*\(|console\.assert\s*\(|throw new Error\(\s*["'`]assert/i.test(code)) return NONE;
    const g = new InputGen(sig, examples, mulberry32(2026));
    const inputs = Array.from({ length: 100 }, () => g.next());
    const res = execute("ts", code, sig, inputs, { timeoutMs: 500 });
    const i = res.findIndex((r) => !r.ok && /assert/i.test(r.e ?? ""));
    if (i < 0) return { ok: true, feedback: "", ran: true };
    return { ok: false, ran: true, feedback: `property tests (random inputs on ${sig.fn})\n${JSON.stringify({ counterexample: inputs[i], error: res[i].e }, null, 2)}` };
  } catch {
    return NONE;
  }
}
