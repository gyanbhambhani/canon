/** Front-end checks, ported from canon.py: canonical form, line length, naming, effects, holes. */
import type * as A from "./ast.js";
import { walkExprs, walkStmts } from "./ast.js";
import { CanonError, diag, type Diagnostic, type Fix } from "./diagnostics.js";
import { unifiedDiff } from "./difflib.js";
import { cmpStr, normalize } from "./normalize.js";
import { parse } from "./parser.js";
import { MAX_LINE, Printer } from "./printer.js";
import { pyLen, pySplitlines } from "./py.js";
import { builtinEffects, checkTypes, pureBuiltins, type TypeInfo } from "./types.js";

export const SNAKE = /^[a-z_][a-z0-9_]*$/;
export const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
export const EFFECTS = ["fs", "io", "net", "rand", "time"];
const EFFECT_SET = new Set(EFFECTS);

/** The oracle's effect table, used by the front-end check so it matches canon.py exactly. */
export const ORACLE_BUILTIN_EFFECTS: Record<string, string[]> = {
  print: ["io"], read_line: ["io"],
  read_file: ["fs"], write_file: ["fs"],
  http_get: ["net"], http_post: ["net"],
  now: ["time"], sleep: ["time"],
  random: ["rand"],
};

/** The oracle's list of pure built-ins (it includes a few names v0 does not ship). */
export const ORACLE_PURE_BUILTINS = new Set([
  "abs", "all", "any", "append", "assert", "concat", "contains", "enumerate", "filter",
  "first", "fold", "get", "group_by", "join", "keys", "last", "len", "map", "max", "min",
  "parse_float", "parse_int", "range", "reverse", "sort_by", "sort_desc_by", "split",
  "sum", "take", "to_string", "trim", "unwrap_or", "values", "zip",
]);

export interface EffectTables {
  effects: Record<string, string[]>;
  pure: Set<string>;
}

export const ORACLE_TABLES: EffectTables = { effects: ORACLE_BUILTIN_EFFECTS, pure: ORACLE_PURE_BUILTINS };

export interface CheckResult {
  ok: boolean;
  canonical: boolean;
  diagnostics: Diagnostic[];
}

export function programText(prog: A.Program): string {
  return new Printer().program(prog);
}

export function makePatch(before: string, after: string, path: string): Fix {
  const rel = path.replace(/^\/+/, "");
  const diff = unifiedDiff(pySplitlines(before, true), pySplitlines(after, true), `a/${rel}`, `b/${rel}`);
  return { kind: "patch", diff };
}

export function checkNames(prog: A.Program): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const bad = (kind: string, name: string, want: string, node: A.Pos) =>
    diags.push(diag("N001", `${kind} '${name}' must be ${want}`, node.line, node.col));
  for (const it of prog.items) {
    if (it.k === "RecordType" || it.k === "SumType") {
      if (!PASCAL.test(it.name)) bad("type", it.name, "PascalCase", it);
      if (it.k === "RecordType") {
        for (const [n] of it.fields) if (!SNAKE.test(n)) bad("field", n, "snake_case", it);
      } else {
        for (const [vn] of it.variants) if (!PASCAL.test(vn)) bad("variant", vn, "PascalCase", it);
      }
    }
    if (it.k === "Fn") {
      if (!SNAKE.test(it.name)) bad("function", it.name, "snake_case", it);
      for (const [n] of it.params) if (!SNAKE.test(n)) bad("parameter", n, "snake_case", it);
      for (const e of it.effects) {
        if (!EFFECT_SET.has(e)) {
          diags.push(diag("E100", `unknown effect '${e}'; the effects are ${EFFECTS.join(", ")}`, it.line, it.col));
        }
      }
    }
    if (it.k === "Fn" || it.k === "Test") {
      for (const s of walkStmts(it.body)) if (s.k === "Let" && !SNAKE.test(s.name)) bad("binding", s.name, "snake_case", s);
    }
  }
  return diags;
}

/** Effect lists are exact. Patches are relative to the original source. */
export function checkEffects(prog: A.Program, src: string, path: string, tables: EffectTables = ORACLE_TABLES): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const user = new Map<string, Set<string>>();
  for (const it of prog.items) if (it.k === "Fn") user.set(it.name, new Set(it.effects));
  prog.items.forEach((it, idx) => {
    if (it.k !== "Fn") return;
    const used = new Map<string, string>();
    let allKnown = true;
    for (const e of walkExprs(it.body)) {
      if (e.k !== "Call" || e.callee.k !== "Name") continue;
      if (e.callee.path.length !== 1) {
        allKnown = false; // imported module function: effects unknown in v0
        continue;
      }
      const name: string = e.callee.path[0];
      let effs: Iterable<string>;
      if (Object.hasOwn(tables.effects, name)) effs = tables.effects[name];
      else if (user.has(name)) effs = user.get(name)!;
      else if (tables.pure.has(name)) effs = [];
      else {
        allKnown = false;
        effs = [];
      }
      for (const ef of effs) if (!used.has(ef)) used.set(ef, name);
    }
    const declared = new Set(it.effects);
    const missing = [...used.keys()].filter((x) => !declared.has(x)).sort(cmpStr);
    const extra = allKnown ? [...declared].filter((x) => !used.has(x)).sort(cmpStr) : [];
    let fix: Fix | undefined;
    if (missing.length || extra.length) {
      const fixed = [...prog.items];
      const all = new Set([...used.keys(), ...(allKnown ? [] : declared)]);
      fixed[idx] = { ...it, effects: [...all].sort(cmpStr) };
      fix = makePatch(src, programText({ k: "Program", items: fixed }), path);
    }
    if (missing.length) {
      const via = missing.map((m) => `${m} (via ${used.get(m)})`).join(", ");
      diags.push(diag("E101", `fn ${it.name} uses effects it does not declare: ${via}`, it.line, it.col,
        { fix, data: { missing } }));
    }
    if (extra.length) {
      diags.push(diag("E102",
        `fn ${it.name} declares effects it never uses: ${extra.join(", ")} (effect lists are exact)`,
        it.line, it.col, { fix, data: { unused: extra } }));
    }
  });
  return diags;
}

export function checkHoles(prog: A.Program): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const fns = new Map<string, A.Fn>();
  for (const it of prog.items) if (it.k === "Fn") fns.set(it.name, it);
  const printer = new Printer();
  const candidates = (want: string | null, exclude: string): string[] => {
    if (want === null) return [];
    const out: string[] = [];
    for (const f of fns.values()) {
      if (f.name !== exclude && printer.ty(f.ret) === want) {
        const sig = f.params.map(([n, t]) => `${n}: ${printer.ty(t)}`).join(", ");
        out.push(`${f.name}(${sig}) -> ${want}`);
      }
    }
    return out;
  };
  for (const it of prog.items) {
    if (it.k !== "Fn") continue;
    const expected = new Map<object, string>();
    for (const s of walkStmts(it.body)) {
      if (s.k === "Return" && s.value !== null && s.value.k === "Hole") expected.set(s.value, printer.ty(it.ret));
    }
    for (const e of walkExprs(it.body)) {
      if (e.k === "Call" && e.callee.k === "Name" && fns.has(e.callee.path[0])) {
        const target = fns.get(e.callee.path[0])!;
        const n = Math.min(e.args.length, target.params.length);
        for (let i = 0; i < n; i++) {
          if (e.args[i].k === "Hole") expected.set(e.args[i], printer.ty(target.params[i][1]));
        }
      }
    }
    for (const e of walkExprs(it.body)) {
      if (e.k !== "Hole") continue;
      const want = expected.get(e) ?? null;
      const label = e.name ? "?" + e.name : "?";
      diags.push(diag("H001",
        `hole ${label} in fn ${it.name}: needs a value of type ${want ?? "unknown (v0 infers only returns and call arguments)"}`,
        e.line, e.col, { data: { expected: want, candidates: candidates(want, it.name) } }));
    }
  }
  return diags;
}

export interface Parsed {
  prog: A.Program;
  canonical: string;
}

/** Parse, normalize and print. Throws CanonError on parse/S001 errors. */
export function parseCanonical(src: string): Parsed {
  const prog = normalize(parse(src));
  return { prog, canonical: programText(prog) };
}

/** The canonical-form diagnostics (C001, L001) shared by the front end and the full checker. */
export function formDiagnostics(src: string, canonical: string, path: string): Diagnostic[] {
  const diags: Diagnostic[] = [];
  if (canonical !== src) {
    const a = pySplitlines(src);
    const b = pySplitlines(canonical);
    let line = Math.min(a.length, b.length) + 1;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        line = i + 1;
        break;
      }
    }
    diags.push(diag("C001",
      "source is not in canonical form; apply the patch (Canon accepts exactly one text per program)",
      line, 1, { fix: makePatch(src, canonical, path) }));
  }
  pySplitlines(canonical).forEach((l, i) => {
    const len = pyLen(l);
    if (len > MAX_LINE) {
      diags.push(diag("L001", `line is ${len} characters (limit ${MAX_LINE}); bind a subexpression with let`,
        i + 1, MAX_LINE + 1));
    }
  });
  return diags;
}

/** Exactly the oracle's check(): the front end only (no types). */
export function checkFront(src: string, path = "main.cn"): CheckResult {
  let parsed: Parsed;
  try {
    parsed = parseCanonical(src);
  } catch (e) {
    if (e instanceof CanonError) return { ok: false, canonical: false, diagnostics: [e.diag] };
    throw e;
  }
  const { prog, canonical } = parsed;
  const diags = [
    ...formDiagnostics(src, canonical, path),
    ...checkNames(prog),
    ...checkEffects(prog, src, path),
    ...checkHoles(prog),
  ];
  return { ok: !diags.some((d) => d.severity === "error"), canonical: canonical === src, diagnostics: diags };
}

export function fmt(src: string): string {
  return parseCanonical(src).canonical;
}

// ---------------------------------------------------------------------------
// The full checker: front end + modules + exact effects over the whole stdlib + types
// ---------------------------------------------------------------------------


export interface Analysis {
  result: CheckResult;
  /** The normalized program (null when it failed to parse). */
  prog: A.Program | null;
  info: TypeInfo | null;
}

let fullTables: EffectTables | null = null;
function specTables(): EffectTables {
  fullTables ??= { effects: builtinEffects(), pure: pureBuiltins() };
  return fullTables;
}

/**
 * Effects of functions used as values (`map(names, print)`): the enclosing function must
 * declare them too, or a value could smuggle an effect past the signature.
 */
function valueEffects(prog: A.Program, src: string, path: string, tables: EffectTables): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const user = new Map<string, string[]>();
  for (const it of prog.items) if (it.k === "Fn") user.set(it.name, it.effects);
  prog.items.forEach((it, idx) => {
    if (it.k !== "Fn") return;
    const callees = new Set<unknown>();
    const all = [...walkExprs(it.body)];
    for (const e of all) if (e.k === "Call") callees.add(e.callee);
    const missing = new Map<string, string>();
    for (const e of all) {
      if (e.k !== "Name" || callees.has(e) || e.path.length !== 1) continue;
      const effs = tables.effects[e.path[0]] ?? user.get(e.path[0]) ?? [];
      for (const ef of effs) if (!it.effects.includes(ef) && !missing.has(ef)) missing.set(ef, e.path[0]);
    }
    if (missing.size) {
      const names = [...missing.keys()].sort(cmpStr);
      const fixed = [...prog.items];
      fixed[idx] = { ...it, effects: [...new Set([...it.effects, ...names])].sort(cmpStr) };
      diags.push(diag("E101",
        `fn ${it.name} uses effects it does not declare: ${names.map((m) => `${m} (via ${missing.get(m)} as a value)`).join(", ")}`,
        it.line, it.col, { fix: makePatch(src, programText({ k: "Program", items: fixed }), path), data: { missing: names } }));
    }
  });
  return diags;
}

export function analyze(src: string, path = "main.cn"): Analysis {
  let parsed: Parsed;
  try {
    parsed = parseCanonical(src);
  } catch (e) {
    if (e instanceof CanonError) {
      return { result: { ok: false, canonical: false, diagnostics: [e.diag] }, prog: null, info: null };
    }
    throw e;
  }
  const { prog, canonical } = parsed;
  const tables = specTables();
  const effectDiags = checkEffects(prog, src, path, tables);
  const typed = checkTypes(prog);
  for (const [d, fixed] of typed.fixes) d.fix = makePatch(src, programText(fixed), path);
  const typeDiags = typed.diagnostics.filter((d) => d.code !== "H001");
  const holes = typed.diagnostics.filter((d) => d.code === "H001");
  const diags = [
    ...formDiagnostics(src, canonical, path),
    ...checkNames(prog),
    ...typeDiags.filter((d) => d.code === "M001"),
    ...effectDiags,
    ...(effectDiags.some((d) => d.code === "E101") ? [] : valueEffects(prog, src, path, tables)),
    ...typeDiags.filter((d) => d.code !== "M001"),
    ...holes,
  ];
  return {
    result: { ok: !diags.some((d) => d.severity === "error"), canonical: canonical === src, diagnostics: diags },
    prog,
    info: typed.info,
  };
}

/** `canon check`: the front end plus modules, exact effects over the full stdlib, and types. */
export function check(src: string, path = "main.cn"): CheckResult {
  return analyze(src, path).result;
}
