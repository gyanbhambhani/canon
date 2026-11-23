/**
 * Language adapters: run a program's function on JSON arguments and return JSON results, so one
 * language-neutral test file serves every language.
 *   canon    compiled to JavaScript by @canon/compiler, run on Canon's runtime (sandbox/js-runner.mjs)
 *   ts       transpiled by TypeScript, run in the same JavaScript sandbox
 *   py       hand-written Python, run by sandbox/py_harness.py
 *   canonpy  Canon compiled to Python by generateFastapi (logic.py + models.py + runtime.py)
 * Value encoding (Experiment 1's): Result is { ok, value } | { ok, error }; Option is the value or
 * null; a tuple is an array; a record is an object; a variant is { kind, ...fields }.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { checkProject, compileJs, generateFastapi, type TypeExpr } from "@canon/compiler";
import { BENCH, ROOT, type Case } from "../lib/seed.js";
import { typeOf } from "../lib/types.js";

export type ExecLang = "canon" | "ts" | "py" | "canonpy";
export interface CallResult {
  ok: boolean;
  v?: unknown;
  e?: string;
}
export interface SigInfo {
  fn: string;
  params: [string, string][];
  ret: string;
  typeKinds?: Record<string, "record" | "sum">;
}

export const VENV = join(ROOT, ".venv", "bin");
const JS_RUNNER = join(BENCH, "sandbox", "js-runner.mjs");
const PY_HARNESS = join(BENCH, "sandbox", "py_harness.py");

// ---------------------------------------------------------------- Canon value conversion

function toCanon(v: unknown, t: TypeExpr, s: SigInfo): unknown {
  if (t.k === "TTuple") return (v as unknown[]).map((x, i) => toCanon(x, t.items[i], s));
  if (t.k !== "TName") return v;
  if (t.name === "Option") return v === null ? { $t: "None" } : { $t: "Some", value: toCanon(v, t.args[0], s) };
  if (t.name === "List") return (v as unknown[]).map((x) => toCanon(x, t.args[0], s));
  if (t.name === "Result") {
    const r = v as { ok: boolean; value?: unknown; error?: unknown };
    return r.ok ? { $t: "Ok", value: toCanon(r.value, t.args[0], s) } : { $t: "Err", error: toCanon(r.error, t.args[1], s) };
  }
  const kind = s.typeKinds?.[t.name];
  if (kind === "record") return { $t: t.name, ...(v as object) };
  if (kind === "sum") {
    const { kind: tag, ...fields } = v as { kind: string };
    return { $t: tag, ...fields };
  }
  return v;
}

function fromCanon(v: unknown, t: TypeExpr, s: SigInfo): unknown {
  if (t.k === "TTuple") return Array.isArray(v) ? v.map((x, i) => fromCanon(x, t.items[i], s)) : v;
  if (t.k !== "TName" || v === null || v === undefined) return v;
  if (t.name === "List") return Array.isArray(v) ? v.map((x) => fromCanon(x, t.args[0], s)) : v;
  const o = v as { $t?: string; value?: unknown; error?: unknown };
  if (t.name === "Option") return o.$t === "Some" ? fromCanon(o.value, t.args[0], s) : o.$t === "None" ? null : v;
  if (t.name === "Result") {
    if (o.$t === "Ok") return { ok: true, value: fromCanon(o.value, t.args[0], s) };
    if (o.$t === "Err") return { ok: false, error: fromCanon(o.error, t.args[1], s) };
    return v;
  }
  const kind = s.typeKinds?.[t.name];
  if (kind && typeof o === "object" && o.$t) {
    const { $t, ...fields } = o as Record<string, unknown>;
    return kind === "sum" ? { kind: $t, ...fields } : fields;
  }
  return v;
}

/** The type tree py_harness.py uses to build Python values. */
function typeTree(t: TypeExpr, s: SigInfo): unknown {
  if (t.k === "TTuple") return { t: "Tuple", a: t.items.map((x) => typeTree(x, s)) };
  if (t.k !== "TName") return { t: "Other" };
  const kind = s.typeKinds?.[t.name];
  if (kind) return { t: kind === "record" ? "Rec" : "Sum", name: t.name };
  return { t: t.name, a: t.args.map((x) => typeTree(x, s)) };
}

// ---------------------------------------------------------------- compile

export interface Compiled {
  ok: boolean;
  error?: string;
  /** JavaScript (canon, ts) or a directory (py, canonpy) */
  artifact?: string;
}

export function compile(lang: ExecLang, code: string): Compiled {
  try {
    if (lang === "canon") {
      const c = compileJs(code, "main.cn");
      return c.js ? { ok: true, artifact: c.js } : { ok: false, error: "does not check" };
    }
    if (lang === "ts") {
      const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      // a top-level function of the right name counts even if the model forgot `export`
      // (Canon and Python find the function by name too)
      const names = [...code.matchAll(/^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
      const fallback = names.map((n) => `\nif (typeof ${n} === "function" && !module.exports.${n}) module.exports.${n} = ${n};`).join("");
      return { ok: true, artifact: js + fallback };
    }
    const dir = mkdtempSync(join(tmpdir(), "cb-py-"));
    if (lang === "py") {
      writeFileSync(join(dir, "main.py"), code);
      return { ok: true, artifact: dir };
    }
    const project = checkProject([{ name: "main", path: "canon/main.cn", src: code }]);
    const errors = project.modules.flatMap((m) => m.result.diagnostics.filter((d) => d.severity === "error"));
    if (errors.length) return { ok: false, error: `does not check: ${errors[0].code}` };
    const files = generateFastapi(project);
    mkdirSync(join(dir, "canon_generated"), { recursive: true });
    for (const f of files) {
      if (f.userOwned) continue;
      const p = join(dir, "canon_generated", f.path);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, f.text);
    }
    writeFileSync(join(dir, "canon_generated", "__init__.py"), "");
    return { ok: true, artifact: dir };
  } catch (e) {
    return { ok: false, error: `compile failed: ${String((e as Error)?.message ?? e).slice(0, 300)}` };
  }
}

// ---------------------------------------------------------------- execute

/** Run sig.fn on each argument list; one result per call (a compile failure fails every call). */
export function execute(lang: ExecLang, code: string, sig: SigInfo, calls: unknown[][], opts: { timeoutMs?: number; compiled?: Compiled } = {}): CallResult[] {
  const c = opts.compiled ?? compile(lang, code);
  if (!c.ok) return calls.map(() => ({ ok: false, e: c.error }));
  const perCall = opts.timeoutMs ?? 2000;
  const wall = Math.min(120_000, 5000 + perCall * calls.length);
  const paramTypes = sig.params.map(([, t]) => typeOf(t));
  const ret = typeOf(sig.ret);
  let raw: string;
  let stderr = "";
  if (lang === "canon" || lang === "ts") {
    const payload = {
      mode: lang,
      js: c.artifact,
      name: sig.fn,
      calls: lang === "canon" ? calls.map((args) => args.map((a, i) => toCanon(a, paramTypes[i], sig))) : calls,
      timeoutMs: perCall,
    };
    const r = spawnSync(process.execPath, ["--max-old-space-size=768", "--stack-size=4000", JS_RUNNER], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: wall,
      maxBuffer: 64 * 1024 * 1024,
      cwd: BENCH,
    });
    raw = r.stdout ?? "";
    stderr = (r.stderr || (r.error ? String(r.error) : "")).slice(-300);
  } else {
    const payload = {
      mode: lang,
      path: c.artifact,
      name: sig.fn,
      calls,
      params: paramTypes.map((t) => typeTree(t, sig)),
      ret: typeTree(ret, sig),
      timeoutS: perCall / 1000,
    };
    const r = spawnSync(join(VENV, "python"), ["-I", PY_HARNESS], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: wall,
      maxBuffer: 64 * 1024 * 1024,
      cwd: c.artifact,
    });
    raw = (r.stdout ?? "").trim().split("\n").pop() ?? "";
    stderr = (r.stderr || (r.error ? String(r.error) : "")).slice(-300);
    if (!opts.compiled) rmSync(c.artifact!, { recursive: true, force: true });
  }
  let results: CallResult[];
  try {
    results = JSON.parse(raw);
    if (!Array.isArray(results) || results.length !== calls.length) throw new Error("bad length");
  } catch {
    return calls.map(() => ({ ok: false, e: `sandbox: ${stderr || "no output"}` }));
  }
  if (lang === "canon") return results.map((r) => (r.ok ? { ok: true, v: fromCanon(r.v, ret, sig) } : r));
  return results;
}

// ---------------------------------------------------------------- scoring

export function approxEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => approxEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return isDeepStrictEqual(ka, kb) && ka.every((k) => approxEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return isDeepStrictEqual(a, b);
}

export interface TestOutcome {
  passed: number;
  total: number;
  wrong: number;
  crashed: number;
  /** the first failing case, as shown in FIX items */
  firstFail?: { args: unknown[]; expected: unknown; actual: unknown; error?: string };
  failing: number[];
}

export function runTests(lang: ExecLang, code: string, sig: SigInfo, cases: Case[], opts: { compiled?: Compiled } = {}): TestOutcome {
  const res = execute(lang, code, sig, cases.map((c) => c.args), opts);
  const out: TestOutcome = { passed: 0, total: cases.length, wrong: 0, crashed: 0, failing: [] };
  res.forEach((r, i) => {
    if (r.ok && approxEqual(r.v, cases[i].expected)) out.passed++;
    else {
      out.failing.push(i);
      if (r.ok) out.wrong++;
      else out.crashed++;
      out.firstFail ??= { args: cases[i].args, expected: cases[i].expected, actual: r.ok ? r.v : null, ...(r.ok ? {} : { error: r.e }) };
    }
  });
  return out;
}
