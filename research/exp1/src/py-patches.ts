/**
 * The "Python with patches" baseline for Experiment 1 (`py-patch`): the same pass criterion as
 * `py-plain` (`mypy --strict` must be clean), but the feedback is JSON in the shape of
 * `canon check --json`, and every error a standard Python tool can fix carries a unified-diff patch:
 *   - mypy's "did you mean X?" suggestions (misspelled names and attributes) become rename patches;
 *   - ruff's automatic fixes (rules E, F, W, B, UP, SIM, RUF) become patches. Ruff findings are
 *     shown alongside mypy's errors when the check fails; they do not change what counts as passing.
 * This mirrors `ts-patch` (tsc errors plus the language service's quick fixes).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pySplitlines, unifiedDiff } from "@canon/compiler";
import type { CheckOutcome, Language } from "../../benchmark/src/languages.js";
import { python } from "./python.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENV = join(HERE, "..", ".venv", "bin");
const FILE = "main.py";
const RUFF_RULES = "E,F,W,B,UP,SIM,RUF";

export interface PyDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  line: number;
  col: number;
  fix?: { kind: "patch"; diff: string };
}

interface MypyJson {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
  message: string;
  code: string | null;
  severity: string;
}

interface RuffEdit {
  content: string;
  location: { row: number; column: number };
  end_location: { row: number; column: number };
}
interface RuffJson {
  code: string | null;
  message: string;
  location: { row: number; column: number };
  fix: { edits: RuffEdit[] } | null;
}

const diff = (before: string, after: string) => unifiedDiff(pySplitlines(before, true), pySplitlines(after, true), `a/${FILE}`, `b/${FILE}`);

/** Offset of (1-based line, 0-based column in code points) in `code`. */
function offsetOf(code: string, line: number, col0: number): number {
  const lines = pySplitlines(code, true);
  let off = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) off += lines[i].length;
  const text = Array.from(lines[line - 1] ?? "");
  return off + text.slice(0, col0).join("").length;
}

function applyEdits(code: string, edits: { start: number; end: number; text: string }[]): string {
  return [...edits].sort((a, b) => b.start - a.start).reduce((s, e) => s.slice(0, e.start) + e.text + s.slice(e.end), code);
}

function runMypy(dir: string): MypyJson[] {
  const r = spawnSync(join(VENV, "mypy"), ["--strict", "--output", "json", FILE], { cwd: dir, encoding: "utf8", timeout: 60_000 });
  return (r.stdout ?? "")
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l) as MypyJson)
    .filter((d) => d.severity === "error");
}

function runRuff(dir: string): RuffJson[] {
  const r = spawnSync(join(VENV, "ruff"), ["check", "--select", RUFF_RULES, "--output-format", "json", "--no-cache", FILE], {
    cwd: dir,
    encoding: "utf8",
    timeout: 60_000,
  });
  try {
    return JSON.parse(r.stdout || "[]") as RuffJson[];
  } catch {
    return [];
  }
}

/** mypy --strict errors (with "did you mean" rename patches) plus ruff's fixable findings. */
export function checkPyWithPatches(code: string): { ok: boolean; diags: PyDiagnostic[] } {
  const dir = mkdtempSync(join(tmpdir(), "canon-pyp-"));
  writeFileSync(join(dir, FILE), code);
  const mypy = runMypy(dir);
  const diags: PyDiagnostic[] = mypy.map((d) => {
    const out: PyDiagnostic = { code: d.code ?? "error", severity: "error", message: d.message, line: d.line, col: d.column + 1 };
    const m = /did you mean "([A-Za-z_][A-Za-z0-9_]*)"\?/.exec(d.message);
    if (m && d.line === d.end_line && d.end_column > d.column) {
      const start = offsetOf(code, d.line, d.column);
      const end = offsetOf(code, d.end_line, d.end_column);
      const fixed = applyEdits(code, [{ start, end, text: m[1] }]);
      if (fixed !== code) out.fix = { kind: "patch", diff: diff(code, fixed) };
    }
    return out;
  });
  const ok = mypy.length === 0;
  if (!ok) {
    for (const r of runRuff(dir)) {
      if (!r.fix || !r.fix.edits.length) continue;
      const edits = r.fix.edits.map((e) => ({
        // ruff columns are 1-based
        start: offsetOf(code, e.location.row, e.location.column - 1),
        end: offsetOf(code, e.end_location.row, e.end_location.column - 1),
        text: e.content,
      }));
      const fixed = applyEdits(code, edits);
      if (fixed === code) continue;
      diags.push({ code: `ruff:${r.code ?? "fix"}`, severity: "warning", message: r.message, line: r.location.row, col: r.location.column, fix: { kind: "patch", diff: diff(code, fixed) } });
    }
  }
  return { ok, diags };
}

export const pyPatch: Language = {
  ...python,
  system:
    python.system +
    " Checker errors come back as JSON; an entry that has a `fix` carries a unified-diff patch, and applying that patch fixes it.",
  check(code: string): CheckOutcome {
    const { ok, diags } = checkPyWithPatches(code);
    return {
      ok,
      feedback: ok ? "" : `mypy --strict main.py --json (with patches)\n${JSON.stringify(diags, null, 2)}`,
      codes: diags.filter((d) => d.severity === "error").map((d) => d.code),
    };
  },
};
