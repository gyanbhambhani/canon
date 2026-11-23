/**
 * The Canon-Py arm for Experiment 1b (docs/roadmap-to-1.0.md), defined here so research/exp1 is not
 * edited. It is the `canon` arm with only the language changed:
 *  - the system prompt's reference is the Canon-Py agent reference (for-agents-py.mdx) instead of
 *    for-agents.mdx, behind the same opening sentence;
 *  - the task's declarations and signature are shown in Canon-Py (converted by fmt);
 *  - check and fmt run with `--syntax py`.
 * The request for output is word for word the `canon` arm's ("Reply with only the complete program
 * in one ```canon code block."), so the two arms differ only in the language they describe.
 * Hidden tests run the same compiled program: the reply is converted to brace syntax by fmt (same
 * AST, so the same code), then the `canon` arm's test harness runs it.
 *
 * To add it to the runner: `SETUPS["canon-py"] = canonPy` in research/exp1/src/run.ts.
 */
import { readFileSync } from "node:fs";
import { check, fmt, V04_PY } from "@canon/compiler";
import { canon, type Language } from "../benchmark/src/languages.js";
import type { Task } from "../benchmark/src/tasks.js";

const py = { features: V04_PY };

const CANON_PY_REFERENCE = readFileSync(new URL("../../apps/web/content/docs/for-agents-py.mdx", import.meta.url), "utf8")
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

const SYSTEM_OPENING = "You write programs in Canon, a small programming language. Below is its complete reference; it is all you need.\n\n";

/** The Canon-Py spelling of a brace-syntax signature, e.g. `def f(xs: list[int]) -> int`. */
export function pySignature(task: Task): string {
  const stub = `fn ${task.fn}(${task.params.map(([n, ty]) => `${n}: ${ty}`).join(", ")}) -> ${task.ret} {\n  return ?\n}\n`;
  const decls = task.decls?.canon ? task.decls.canon + "\n\n" : "";
  const text = fmt(decls + stub, py);
  const def = text.slice(text.indexOf(`def ${task.fn}`));
  return def.slice(0, def.indexOf(":\n"));
}

export const canonPy: Language = {
  ...canon,
  system: SYSTEM_OPENING + CANON_PY_REFERENCE,
  prompt: (task) => {
    // the canon arm's prompt, with its Canon text converted to Canon-Py and nothing else changed
    let p = canon.prompt(task);
    if (task.decls?.canon) p = p.replace(task.decls.canon, fmt(task.decls.canon + "\n", py).trimEnd());
    const braceSig = `fn ${task.fn}(${task.params.map(([n, ty]) => `${n}: ${ty}`).join(", ")}) -> ${task.ret}`;
    return p.replace(braceSig, pySignature(task)).replace("Do not write fn main or test blocks.", "Do not write def main or test functions.");
  },
  check(code) {
    const r = check(code, "main.cn", py);
    return {
      ok: r.ok,
      feedback: r.ok ? "" : `canon check --syntax py main.cn --json\n${JSON.stringify(r.diagnostics, null, 2)}`,
      codes: r.diagnostics.map((d) => d.code),
    };
  },
  async normalize(code) {
    try {
      return fmt(code, py);
    } catch {
      return code;
    }
  },
  test(code, task) {
    let brace: string;
    try {
      brace = fmt(code);
    } catch {
      return { passed: 0, total: task.tests.length, error: "does not parse" };
    }
    return canon.test(brace, task);
  },
};
