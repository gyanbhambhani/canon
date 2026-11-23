/**
 * The "TypeScript with patches" baseline for Experiment 1: tsc --strict diagnostics in the same
 * JSON shape as `canon check --json`, where every error the TypeScript language service can fix
 * (its editor quick fixes, `getCodeFixesAtPosition`) carries a unified-diff patch. This isolates
 * Canon's patch-returning loop from the Canon language itself.
 */
import ts from "typescript";
import { pySplitlines, unifiedDiff } from "@canon/compiler";

const FILE = "main.ts";

export const TS_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  lib: ["lib.es2022.d.ts"],
  types: [],
  skipLibCheck: true,
};

export interface TsDiagnostic {
  code: string;
  severity: "error";
  message: string;
  line: number;
  col: number;
  fix?: { kind: "patch"; diff: string };
}

function service(code: string): ts.LanguageService {
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => TS_OPTIONS,
    getScriptFileNames: () => [FILE],
    getScriptVersion: () => "1",
    getScriptSnapshot: (f) => (f === FILE ? ts.ScriptSnapshot.fromString(code) : ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)!) : undefined),
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => f === FILE || ts.sys.fileExists(f),
    readFile: (f) => (f === FILE ? code : ts.sys.readFile(f)),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function applyChanges(code: string, changes: readonly ts.TextChange[]): string {
  // apply from the end so earlier offsets stay valid
  return [...changes]
    .sort((a, b) => b.span.start - a.span.start)
    .reduce((s, c) => s.slice(0, c.span.start) + c.newText + s.slice(c.span.start + c.span.length), code);
}

/** tsc --strict diagnostics for `code`, each with a patch when TypeScript offers a quick fix. */
export function checkWithPatches(code: string): TsDiagnostic[] {
  const ls = service(code);
  const diags = [...ls.getSyntacticDiagnostics(FILE), ...ls.getSemanticDiagnostics(FILE)];
  const sf = ls.getProgram()!.getSourceFile(FILE)!;
  return diags.map((d) => {
    const start = d.start ?? 0;
    const { line, character } = sf.getLineAndCharacterOfPosition(start);
    const out: TsDiagnostic = {
      code: `TS${d.code}`,
      severity: "error",
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      line: line + 1,
      col: character + 1,
    };
    let fixes: readonly ts.CodeFixAction[] = [];
    try {
      fixes = ls.getCodeFixesAtPosition(FILE, start, start + (d.length ?? 0), [d.code], {}, {});
    } catch {
      fixes = [];
    }
    const fix = fixes.find((f) => f.changes.length === 1 && f.changes[0].fileName === FILE);
    if (fix) {
      const fixed = applyChanges(code, fix.changes[0].textChanges);
      if (fixed !== code) {
        out.fix = { kind: "patch", diff: unifiedDiff(pySplitlines(code, true), pySplitlines(fixed, true), `a/${FILE}`, `b/${FILE}`) };
      }
    }
    return out;
  });
}
