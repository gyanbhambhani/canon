/**
 * Each language's best standard toolchain, with the same shape of feedback (JSON diagnostics, with
 * a unified-diff patch wherever the tool offers one) and the same automatic-fix policy: every arm
 * applies its own toolchain's automatic fixes before checking, and that never costs a round.
 *
 *   canon  automatic fixes: `canon check --fix` (mechanical codes C001, E101, E102, T009)
 *          checker: `canon check --json` with patches
 *   py     automatic fixes: `ruff check --fix` (rules E, F, W, B, UP, SIM, RUF; safe fixes only)
 *          checker: `mypy --strict`, as JSON, with "did you mean" rename patches and ruff's fixes as patches
 *   ts     automatic fixes: `eslint --fix` (typescript-eslint recommended)
 *          checker: `tsc --strict`, as JSON, with the language service's quick fixes as patches
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { check as canonCheck, fix as canonFix, pySplitlines, unifiedDiff } from "@canon/compiler";
import { PY_SURFACE, VENV } from "../adapters/exec.js";
import type { Lang } from "../lib/seed.js";

export interface Diag {
  code: string;
  severity: string;
  message: string;
  line: number;
  col: number;
  fix?: { kind: "patch"; diff: string };
}

export interface CheckOutcome {
  ok: boolean;
  /** what the model is shown when the check fails */
  feedback: string;
  codes: string[];
  errors: number;
}

const errorCount = (ds: Diag[]) => ds.filter((d) => d.severity === "error").length;

// ---------------------------------------------------------------- Canon

function canonDiags(code: string, surfacePy = false): Diag[] {
  return canonCheck(code, "main.cn", surfacePy ? PY_SURFACE : {}).diagnostics as Diag[];
}

// ---------------------------------------------------------------- Python

const PY_FILE = "main.py";
const RUFF_RULES = "E,F,W,B,UP,SIM,RUF";
const MYPY_CACHE = join(tmpdir(), `canonbench-mypy-${process.pid}`);
mkdirSync(MYPY_CACHE, { recursive: true });

interface MypyJson {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
  message: string;
  code: string | null;
  severity: string;
}
interface RuffJson {
  code: string | null;
  message: string;
  location: { row: number; column: number };
  fix: { edits: { content: string; location: { row: number; column: number }; end_location: { row: number; column: number } }[] } | null;
}

const pyDiff = (a: string, b: string, file: string) => unifiedDiff(pySplitlines(a, true), pySplitlines(b, true), `a/${file}`, `b/${file}`);

function offsetOf(code: string, line: number, col0: number): number {
  const lines = pySplitlines(code, true);
  let off = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) off += lines[i].length;
  return off + Array.from(lines[line - 1] ?? "").slice(0, col0).join("").length;
}

function applyEdits(code: string, edits: { start: number; end: number; text: string }[]): string {
  return [...edits].sort((a, b) => b.start - a.start).reduce((s, e) => s.slice(0, e.start) + e.text + s.slice(e.end), code);
}

function withPyFile<T>(code: string, f: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "cb-chk-"));
  try {
    writeFileSync(join(dir, PY_FILE), code);
    return f(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pyDiags(code: string): Diag[] {
  return withPyFile(code, (dir) => {
    const r = spawnSync(join(VENV, "mypy"), ["--strict", "--output", "json", "--cache-dir", MYPY_CACHE, PY_FILE], { cwd: dir, encoding: "utf8", timeout: 90_000 });
    const mypy = (r.stdout ?? "")
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l) => JSON.parse(l) as MypyJson)
      .filter((d) => d.severity === "error");
    if (r.status !== 0 && mypy.length === 0) {
      // mypy crashed or could not parse: report it as one error
      return [{ code: "mypy", severity: "error", message: (r.stdout || r.stderr || "mypy failed").slice(0, 800), line: 1, col: 1 }];
    }
    const diags: Diag[] = mypy.map((d) => {
      const out: Diag = { code: d.code ?? "error", severity: "error", message: d.message, line: d.line, col: d.column + 1 };
      const m = /did you mean "([A-Za-z_][A-Za-z0-9_]*)"\?/.exec(d.message);
      if (m && d.line === d.end_line && d.end_column > d.column) {
        const fixed = applyEdits(code, [{ start: offsetOf(code, d.line, d.column), end: offsetOf(code, d.end_line, d.end_column), text: m[1] }]);
        if (fixed !== code) out.fix = { kind: "patch", diff: pyDiff(code, fixed, PY_FILE) };
      }
      return out;
    });
    if (diags.length) {
      const rr = spawnSync(join(VENV, "ruff"), ["check", "--select", RUFF_RULES, "--output-format", "json", "--no-cache", PY_FILE], { cwd: dir, encoding: "utf8", timeout: 60_000 });
      let ruff: RuffJson[] = [];
      try {
        ruff = JSON.parse(rr.stdout || "[]");
      } catch {
        ruff = [];
      }
      for (const f of ruff) {
        if (!f.fix?.edits.length) continue;
        const fixed = applyEdits(
          code,
          f.fix.edits.map((e) => ({ start: offsetOf(code, e.location.row, e.location.column - 1), end: offsetOf(code, e.end_location.row, e.end_location.column - 1), text: e.content })),
        );
        if (fixed !== code) diags.push({ code: `ruff:${f.code ?? "fix"}`, severity: "warning", message: f.message, line: f.location.row, col: f.location.column, fix: { kind: "patch", diff: pyDiff(code, fixed, PY_FILE) } });
      }
    }
    return diags;
  });
}

function ruffFix(code: string): string {
  return withPyFile(code, (dir) => {
    spawnSync(join(VENV, "ruff"), ["check", "--select", RUFF_RULES, "--fix", "--no-cache", "--quiet", PY_FILE], { cwd: dir, encoding: "utf8", timeout: 60_000 });
    try {
      return readFileSync(join(dir, PY_FILE), "utf8");
    } catch {
      return code;
    }
  });
}

// ---------------------------------------------------------------- TypeScript

const TS_FILE = "main.ts";
const TS_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  lib: ["lib.es2022.d.ts"],
  types: [],
  skipLibCheck: true,
};

function tsService(code: string): ts.LanguageService {
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => TS_OPTIONS,
    getScriptFileNames: () => [TS_FILE],
    getScriptVersion: () => "1",
    getScriptSnapshot: (f) => (f === TS_FILE ? ts.ScriptSnapshot.fromString(code) : ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)!) : undefined),
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => f === TS_FILE || ts.sys.fileExists(f),
    readFile: (f) => (f === TS_FILE ? code : ts.sys.readFile(f)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function tsDiags(code: string): Diag[] {
  const ls = tsService(code);
  const diags = [...ls.getSyntacticDiagnostics(TS_FILE), ...ls.getSemanticDiagnostics(TS_FILE)];
  const sf = ls.getProgram()!.getSourceFile(TS_FILE)!;
  return diags.map((d) => {
    const start = d.start ?? 0;
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    const out: Diag = { code: `TS${d.code}`, severity: "error", message: ts.flattenDiagnosticMessageText(d.messageText, "\n"), line: line + 1, col: character + 1 };
    let fixes: readonly ts.CodeFixAction[] = [];
    try {
      fixes = ls.getCodeFixesAtPosition(TS_FILE, start, start + (d.length ?? 0), [d.code], {}, {});
    } catch {
      fixes = [];
    }
    const fx = fixes.find((f) => f.changes.length === 1 && f.changes[0].fileName === TS_FILE);
    if (fx) {
      const fixed = [...fx.changes[0].textChanges]
        .sort((a, b) => b.span.start - a.span.start)
        .reduce((s, c) => s.slice(0, c.span.start) + c.newText + s.slice(c.span.start + c.span.length), code);
      if (fixed !== code) out.fix = { kind: "patch", diff: pyDiff(code, fixed, TS_FILE) };
    }
    return out;
  });
}

let eslintPromise: Promise<{ lintText(code: string, o: { filePath: string }): Promise<{ output?: string }[]> }> | null = null;
async function eslint() {
  eslintPromise ??= (async () => {
    const { ESLint } = await import("eslint");
    const tseslint = (await import("typescript-eslint")).default;
    return new ESLint({ cwd: tmpdir(), overrideConfigFile: true, overrideConfig: [...tseslint.configs.recommended] as never, fix: true }) as never;
  })();
  return eslintPromise;
}

async function eslintFix(code: string): Promise<string> {
  try {
    const [r] = await (await eslint()).lintText(code, { filePath: join(tmpdir(), TS_FILE) });
    return r?.output ?? code;
  } catch {
    return code;
  }
}

// ---------------------------------------------------------------- public

/** The checker alone (no automatic fixes): used to verify references and mutants. */
export function checkCode(lang: Lang, code: string): CheckOutcome {
  const ds = lang === "canon" || lang === "cpy" ? canonDiags(code, lang === "cpy") : lang === "py" ? pyDiags(code) : tsDiags(code);
  return outcome(lang, ds);
}

function outcome(lang: Lang, ds: Diag[]): CheckOutcome {
  const errors = errorCount(ds);
  const head = lang === "canon" ? "canon check main.cn --json" : lang === "cpy" ? "canon check --syntax py main.cn --json" : lang === "py" ? "mypy --strict main.py --json (with patches)" : "tsc --strict main.ts --json (with patches)";
  return { ok: errors === 0, feedback: errors ? `${head}\n${JSON.stringify(ds, null, 2)}` : "", codes: ds.filter((d) => d.severity === "error").map((d) => d.code), errors };
}

export interface ToolchainOutcome extends CheckOutcome {
  /** the program after automatic fixes */
  code: string;
  /** checker errors on the program as the model wrote it */
  errorsBefore: number;
  /** codes of the automatic fixes that changed the program */
  autoFixed: boolean;
}

/** Automatic fixes, then the checker. */
export async function toolchain(lang: Lang, code: string): Promise<ToolchainOutcome> {
  if (lang === "canon" || lang === "cpy") {
    const before = errorCount(canonDiags(code, lang === "cpy"));
    const f = canonFix(code, "main.cn", lang === "cpy" ? PY_SURFACE : {});
    const o = outcome(lang, f.result.diagnostics as Diag[]);
    return { ...o, code: f.source, errorsBefore: before, autoFixed: f.applied.length > 0 };
  }
  if (lang === "py") {
    const fixed = ruffFix(code);
    const after = pyDiags(fixed);
    const before = fixed === code ? errorCount(after) : errorCount(pyDiags(code));
    return { ...outcome(lang, after), code: fixed, errorsBefore: before, autoFixed: fixed !== code };
  }
  const fixed = await eslintFix(code);
  const after = tsDiags(fixed);
  const before = fixed === code ? errorCount(after) : errorCount(tsDiags(code));
  return { ...outcome(lang, after), code: fixed, errorsBefore: before, autoFixed: fixed !== code };
}
