/**
 * The Python arm of Experiment 1 (`py-plain`): the same tasks, checked with `mypy --strict` (Python's
 * strict type checker, the analogue of `tsc --strict`) and run against the same hidden tests.
 *
 * Types come from each task's Canon signature and declarations, so all languages solve identical
 * specs: Int -> int, Float -> float, String -> str, Bool -> bool, List[T] -> list[T],
 * Option[T] -> T | None, (A, B) -> tuple[A, B], records and variants -> TypedDicts (variants carry
 * a `kind: Literal[...]` tag, as in the TypeScript arm), Result[T, String] -> Ok[T] | Err.
 * Test values are the same JSON as the other arms: records and variants are dicts.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { lex, parse, Parser, type TypeExpr } from "@canon/compiler";
import { type CheckOutcome, type Language, type TestOutcome } from "../../benchmark/src/languages.js";
import type { Task } from "../../benchmark/src/tasks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENV = join(HERE, "..", ".venv", "bin");
const RUN_TIMEOUT_MS = 5000;

const typeOf = (s: string): TypeExpr => new Parser(lex(s)).typeExpr();

function pyType(t: TypeExpr): string {
  if (t.k === "TTuple") return `tuple[${t.items.map(pyType).join(", ")}]`;
  if (t.k === "TFn") return `Callable[[${t.params.map(pyType).join(", ")}], ${pyType(t.ret)}]`;
  switch (t.name) {
    case "Int":
      return "int";
    case "Float":
      return "float";
    case "String":
      return "str";
    case "Bool":
      return "bool";
    case "Unit":
      return "None";
    case "List":
      return `list[${pyType(t.args[0])}]`;
    case "Option":
      return `${pyType(t.args[0])} | None`;
    case "Result":
      return `Ok[${pyType(t.args[0])}] | Err`;
  }
  return t.name;
}

/** Python declarations for a task: the Result helpers when used, and TypedDicts for its types. */
export function pyDecls(task: Task): string {
  const lines: string[] = ["from __future__ import annotations", "from typing import Callable, Generic, Literal, TypedDict, TypeVar", ""];
  const usesResult = [task.ret, ...task.params.map(([, t]) => t)].some((t) => t.includes("Result"));
  if (usesResult) {
    lines.push('T = TypeVar("T")', "", "class Ok(TypedDict, Generic[T]):", "    ok: Literal[True]", "    value: T", "", "class Err(TypedDict):", "    ok: Literal[False]", "    error: str", "");
  }
  if (task.decls?.canon) {
    for (const it of parse(task.decls.canon).items) {
      if (it.k === "RecordType") {
        lines.push(`class ${it.name}(TypedDict):`, ...it.fields.map(([n, t]) => `    ${n}: ${pyType(t)}`), "");
      } else if (it.k === "SumType") {
        const names: string[] = [];
        for (const [vn, fields] of it.variants) {
          names.push(`${vn}`);
          lines.push(`class ${vn}(TypedDict):`, `    kind: Literal["${vn}"]`, ...fields.map(([n, t]) => `    ${n}: ${pyType(t)}`), "");
        }
        lines.push(`${it.name} = ${names.join(" | ")}`, "");
      }
    }
  }
  return lines.join("\n");
}

const signature = (task: Task) =>
  `def ${task.fn}(${task.params.map(([n, t]) => `${n}: ${pyType(typeOf(t))}`).join(", ")}) -> ${pyType(typeOf(task.ret))}:`;

/** JSON test values to Python values: tuples arrive as lists and are converted by the harness. */
const HARNESS = `
import json, sys, importlib.util
spec = importlib.util.spec_from_file_location("main", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
f = getattr(mod, sys.argv[2])
def plain(v):
    if isinstance(v, tuple): return [plain(x) for x in v]
    if isinstance(v, list): return [plain(x) for x in v]
    if isinstance(v, dict): return {k: plain(x) for k, x in v.items()}
    return v
out = []
for args in json.load(sys.stdin):
    try:
        out.append({"ok": True, "v": plain(f(*args))})
    except Exception as e:
        out.append({"ok": False, "e": type(e).__name__ + ": " + str(e)[:200]})
print(json.dumps(out))
`;

function approxEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => approxEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return isDeepStrictEqual(ka, kb) && ka.every((k) => approxEqual((a as any)[k], (b as any)[k]));
  }
  return isDeepStrictEqual(a, b);
}

/** JSON test arguments: tuple-typed parameters become Python tuples via a small prelude. */
function argsJson(task: Task): string {
  return JSON.stringify(task.tests.map(([args]) => args));
}

export const python: Language = {
  id: "typescript", // the Language type's id union predates this arm; Experiment 1 keys runs by setup name
  fence: "python|py",
  system: "You write Python 3.12 with full type annotations that pass `mypy --strict`. Use only the standard library; no I/O.",
  prompt: (task) =>
    `Your module must start with these declarations, exactly as written:\n\n\`\`\`python\n${pyDecls(task).trim()}\n\`\`\`\n\n` +
    `Write a Python module that defines this function:\n\n${signature(task)}\n\n` +
    `${task.desc}\n\n` +
    "Integers are int and fractional numbers are float. You may add helper functions. Do not write tests or example calls. " +
    "Reply with only the complete module in one ```python code block.",
  check(code: string): CheckOutcome {
    const dir = mkdtempSync(join(tmpdir(), "canon-py-"));
    const file = join(dir, "main.py");
    writeFileSync(file, code);
    const r = spawnSync(join(VENV, "mypy"), ["--strict", "--no-error-summary", "--hide-error-context", "--no-color-output", "main.py"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 60_000,
    });
    const errors = (r.stdout ?? "").split("\n").filter((l) => /: error: /.test(l));
    return {
      ok: r.status === 0 && errors.length === 0,
      feedback: errors.length ? `mypy --strict main.py\n${errors.join("\n")}` : r.status === 0 ? "" : (r.stdout || r.stderr || "mypy failed").slice(0, 2000),
      codes: errors.map((l) => /\[([\w-]+)\]\s*$/.exec(l)?.[1] ?? "error"),
    };
  },
  async normalize(code: string) {
    return code;
  },
  test(code: string, task: Task): TestOutcome {
    const dir = mkdtempSync(join(tmpdir(), "canon-py-"));
    const file = join(dir, "main.py");
    writeFileSync(file, code);
    // tuple-typed parameters: convert JSON lists to tuples before the call
    const tupleParams = task.params.map(([, t]) => typeOf(t).k === "TTuple");
    const harness = tupleParams.some(Boolean)
      ? HARNESS.replace("f(*args)", `f(*[tuple(a) if t else a for a, t in zip(args, ${JSON.stringify(tupleParams).replace(/true/g, "True").replace(/false/g, "False")})])`)
      : HARNESS;
    const r = spawnSync(join(VENV, "python"), ["-I", "-c", harness, file, task.fn], { input: argsJson(task), encoding: "utf8", timeout: RUN_TIMEOUT_MS, cwd: dir });
    if (r.status !== 0 || !r.stdout.trim()) {
      return { passed: 0, total: task.tests.length, wrong: 0, crashed: task.tests.length, error: (r.stderr || (r.error ? String(r.error) : "no output")).slice(-300) };
    }
    let results: { ok: boolean; v?: unknown; e?: string }[];
    try {
      results = JSON.parse(r.stdout.trim().split("\n").pop()!);
    } catch {
      return { passed: 0, total: task.tests.length, wrong: 0, crashed: task.tests.length, error: "unreadable output" };
    }
    let passed = 0;
    let wrong = 0;
    let crashed = 0;
    let error: string | undefined;
    results.forEach((res, i) => {
      if (res.ok && approxEqual(res.v, task.tests[i][1])) passed++;
      else if (res.ok) wrong++;
      else {
        crashed++;
        error ??= res.e;
      }
    });
    return { passed, total: task.tests.length, wrong, crashed, ...(error ? { error } : {}) };
  },
};
