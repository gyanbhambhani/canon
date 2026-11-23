/**
 * The two languages under test. Each knows how to prompt for a task, check a candidate,
 * normalize it (to count distinct programs) and run the task's tests against it.
 */
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import vm from "node:vm";
import * as prettier from "prettier";
import ts from "typescript";
import { check, compileJs, fmt, lex, Parser, type TypeExpr } from "@canon/compiler";
import { MemoryHost, Runtime, testHost } from "@canon/runtime";
import type { Task } from "./tasks.js";

export interface CheckOutcome {
  ok: boolean;
  /** What the model is shown when the check fails. */
  feedback: string;
  codes: string[];
}

export interface TestOutcome {
  passed: number;
  total: number;
  error?: string;
}

export interface Language {
  id: "canon" | "typescript";
  fence: string;
  system: string;
  prompt(task: Task): string;
  check(code: string): CheckOutcome;
  normalize(code: string): Promise<string>;
  test(code: string, task: Task): TestOutcome;
}

const RUN_TIMEOUT_MS = 2000;

export function extractCode(text: string, fence: string): string {
  const re = new RegExp("```(?:" + fence + ")?[^\\n]*\\n([\\s\\S]*?)```", "m");
  const m = re.exec(text);
  return (m ? m[1] : text).replace(/\s+$/, "") + "\n";
}

// ---- value conversion between JSON test values and Canon runtime values
const typeOf = (s: string): TypeExpr => new Parser(lex(s)).typeExpr();

function toCanon(v: unknown, t: TypeExpr, task: Task): unknown {
  if (t.k === "TTuple") return (v as unknown[]).map((x, i) => toCanon(x, t.items[i], task));
  if (t.k !== "TName") return v;
  if (t.name === "Option") return v === null ? { $t: "None" } : { $t: "Some", value: toCanon(v, t.args[0], task) };
  if (t.name === "List") return (v as unknown[]).map((x) => toCanon(x, t.args[0], task));
  if (t.name === "Result") {
    const r = v as { ok: boolean; value?: unknown; error?: unknown };
    return r.ok ? { $t: "Ok", value: toCanon(r.value, t.args[0], task) } : { $t: "Err", error: toCanon(r.error, t.args[1], task) };
  }
  const kind = task.typeKinds?.[t.name];
  if (kind === "record") return { $t: t.name, ...(v as object) };
  if (kind === "sum") {
    const { kind: tag, ...fields } = v as { kind: string };
    return { $t: tag, ...fields };
  }
  return v;
}

function fromCanon(v: unknown, t: TypeExpr, task: Task): unknown {
  if (t.k === "TTuple") return Array.isArray(v) ? v.map((x, i) => fromCanon(x, t.items[i], task)) : v;
  if (t.k !== "TName" || v === null || v === undefined) return v;
  if (t.name === "List") return Array.isArray(v) ? v.map((x) => fromCanon(x, t.args[0], task)) : v;
  const o = v as { $t?: string; value?: unknown; error?: unknown };
  if (t.name === "Option") return o.$t === "Some" ? fromCanon(o.value, t.args[0], task) : o.$t === "None" ? null : v;
  if (t.name === "Result") {
    if (o.$t === "Ok") return { ok: true, value: fromCanon(o.value, t.args[0], task) };
    if (o.$t === "Err") return { ok: false, error: fromCanon(o.error, t.args[1], task) };
    return v;
  }
  const kind = task.typeKinds?.[t.name];
  if (kind && typeof o === "object" && o.$t) {
    const { $t, ...fields } = o as Record<string, unknown>;
    return kind === "sum" ? { kind: $t, ...fields } : fields;
  }
  return v;
}

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

/** Run `calls` (a JS expression list) inside a fresh context with a time limit. */
function runIsolated(script: string, context: Record<string, unknown>): { results?: { ok: boolean; v?: unknown; e?: string }[]; error?: string } {
  try {
    const results = vm.runInNewContext(script, { ...context }, { timeout: RUN_TIMEOUT_MS });
    return { results: JSON.parse(JSON.stringify(results)) };
  } catch (e) {
    return { error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}

const CALL_ALL = `
  tests.map((args) => {
    try { return { ok: true, v: f(...args) }; }
    catch (e) { return { ok: false, e: String(e && e.message || e) }; }
  })`;

function score(task: Task, results: { ok: boolean; v?: unknown; e?: string }[], decode: (v: unknown) => unknown): TestOutcome {
  let passed = 0;
  let error: string | undefined;
  results.forEach((r, i) => {
    if (r.ok && approxEqual(decode(r.v), task.tests[i][1])) passed++;
    else if (!r.ok) error ??= r.e;
  });
  return { passed, total: task.tests.length, ...(error ? { error } : {}) };
}

// ---- Canon
const CANON_REFERENCE = readFileSync(new URL("../../../apps/web/content/docs/for-agents.mdx", import.meta.url), "utf8")
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

export const canon: Language = {
  id: "canon",
  fence: "canon|cn",
  system:
    "You write programs in Canon, a small programming language. Below is its complete reference; it is all you need.\n\n" +
    CANON_REFERENCE,
  prompt: (task) =>
    (task.decls?.canon ? `Your program must start with these type declarations, exactly as written:\n\n\`\`\`canon\n${task.decls.canon}\n\`\`\`\n\n` : "") +
    `Write a Canon program that defines this function:\n\n` +
    `fn ${task.fn}(${task.params.map(([n, ty]) => `${n}: ${ty}`).join(", ")}) -> ${task.ret}\n\n` +
    `${task.desc}\n\n` +
    "You may add helper functions. Do not write fn main or test blocks. " +
    "Reply with only the complete program in one ```canon code block.",
  check(code) {
    const r = check(code, "main.cn");
    return {
      ok: r.ok,
      feedback: r.ok ? "" : `canon check main.cn --json\n${JSON.stringify(r.diagnostics, null, 2)}`,
      codes: r.diagnostics.map((d) => d.code),
    };
  },
  async normalize(code) {
    try {
      return fmt(code);
    } catch {
      return code;
    }
  },
  test(code, task) {
    const c = compileJs(code, "main.cn");
    if (!c.js) return { passed: 0, total: task.tests.length, error: "does not check" };
    const paramTypes = task.params.map(([, ty]) => typeOf(ty));
    const ret = typeOf(task.ret);
    const rt = new Runtime(testHost(new MemoryHost()));
    const r = runIsolated(`const mod = (new Function("$rt", js))(rt); const f = mod.fns[name]; if (!f) throw new Error("no fn " + name);` + CALL_ALL, {
      js: c.js,
      rt,
      name: task.fn,
      tests: task.tests.map(([args]) => args.map((a, i) => toCanon(a, paramTypes[i], task))),
    });
    if (!r.results) return { passed: 0, total: task.tests.length, error: r.error };
    return score(task, r.results, (v) => fromCanon(v, ret, task));
  },
};

// ---- TypeScript
function tsType(t: TypeExpr): string {
  if (t.k === "TTuple") return `[${t.items.map(tsType).join(", ")}]`;
  if (t.k === "TFn") return `(${t.params.map((p, i) => `a${i}: ${tsType(p)}`).join(", ")}) => ${tsType(t.ret)}`;
  switch (t.name) {
    case "Int":
    case "Float":
      return "number";
    case "String":
      return "string";
    case "Bool":
      return "boolean";
    case "List": {
      const inner = tsType(t.args[0]);
      return /[|\s]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
    }
    case "Option":
      return `${tsType(t.args[0])} | null`;
    case "Result":
      return `Result<${tsType(t.args[0])}>`;
  }
  return t.name;
}

const TS_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  lib: ["lib.es2022.d.ts"],
  types: [],
  skipLibCheck: true,
};

export const typescript: Language = {
  id: "typescript",
  fence: "ts|typescript",
  system: "You write TypeScript in strict mode (ES2022, no DOM, no Node APIs, no imports).",
  prompt: (task) =>
    (task.decls?.ts ? `Your module must start with these type declarations, exactly as written:\n\n\`\`\`ts\n${task.decls.ts}\n\`\`\`\n\n` : "") +
    `Write a TypeScript module that exports this function:\n\n` +
    `export function ${task.fn}(${task.params.map(([n, ty]) => `${n}: ${tsType(typeOf(ty))}`).join(", ")}): ${tsType(typeOf(task.ret))}\n\n` +
    `${task.desc}\n\n` +
    "Integers are numbers with no fractional part. You may add helper functions. Do not write tests or example calls. " +
    "Reply with only the complete module in one ```ts code block.",
  check(code) {
    const host = ts.createCompilerHost(TS_OPTIONS);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (file, lang, ...rest) =>
      file === "main.ts" ? ts.createSourceFile(file, code, lang) : original(file, lang, ...rest);
    host.fileExists = ((orig) => (f: string) => f === "main.ts" || orig(f))(host.fileExists.bind(host));
    const program = ts.createProgram(["main.ts"], TS_OPTIONS, host);
    const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === "main.ts" || !d.file);
    const text = diags.map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (!d.file || d.start === undefined) return `error TS${d.code}: ${msg}`;
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      return `main.ts(${line + 1},${character + 1}): error TS${d.code}: ${msg}`;
    });
    return { ok: diags.length === 0, feedback: text.length ? `tsc --strict --noEmit main.ts\n${text.join("\n")}` : "", codes: diags.map((d) => `TS${d.code}`) };
  },
  async normalize(code) {
    try {
      return await prettier.format(code, { parser: "typescript" });
    } catch {
      return code;
    }
  },
  test(code, task) {
    const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const r = runIsolated(
      `const module = { exports: {} }; (new Function("exports", "module", js))(module.exports, module); const f = module.exports[name]; if (!f) throw new Error("no export " + name);` + CALL_ALL,
      { js, name: task.fn, tests: task.tests.map(([args]) => args) },
    );
    if (!r.results) return { passed: 0, total: task.tests.length, error: r.error };
    return score(task, r.results, (v) => v);
  },
};

export const LANGUAGES = { canon, typescript };
