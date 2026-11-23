/** Front-end checks, ported from canon.py: canonical form, line length, naming, effects, holes. */
import type * as A from "./ast.js";
import { isExtern, walkExprs, walkStmts } from "./ast.js";
import { CanonError, diag, type Diagnostic, type Fix } from "./diagnostics.js";
import { features, withFeatures, type CompileOptions } from "./features.js";
import { unifiedDiff } from "./difflib.js";
import { cmpStr, normalize } from "./normalize.js";
import { parse } from "./parser.js";
import { applyPatch } from "./patch.js";
import { MAX_LINE, Printer } from "./printer.js";
import { isPySource } from "./pyparser.js";
import { pyNormalize } from "./pynormalize.js";
import { PyPrinter, testIdent } from "./pyprinter.js";
import { pyLen, pySplitlines } from "./py.js";
import { builtinEffects, checkTypes, pureBuiltins, type TypeInfo } from "./types.js";
import { STORE_BUILTINS } from "./prelude.js";
import { checkApi } from "./api.js";

export const SNAKE = /^[a-z_][a-z0-9_]*$/;
export const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
export const EFFECTS = ["fs", "io", "net", "rand", "time"];
const EFFECT_SET = new Set(EFFECTS);
/** v0.3: the effects a test block must declare. The test host makes io, time and rand deterministic. */
export const TEST_REAL_EFFECTS = new Set(["fs", "net"]);

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

/** The canonical text of a program in the active surface (Canon-Py when the py switch is on). */
export function programText(prog: A.Program): string {
  return features().py ? new PyPrinter().program(prog) : new Printer().program(prog);
}

/** A printer for types, expressions and patterns in messages, in the active surface. */
export function surfacePrinter(): { ty(t: A.TypeExpr): string; ex(e: A.Expr, min?: number): string; pat(p: A.Pattern): string } {
  return features().py ? new PyPrinter() : new Printer();
}

/** How a message names a function or a test: `fn f` / `test "x"`, or `def f` / `def test_x` in Canon-Py. */
export function itemLabel(it: A.Fn | A.Test): string {
  if (it.k === "Fn") return features().py ? `def ${it.name}` : `fn ${it.name}`;
  return features().py ? `def ${testIdent(it.name)}` : `test ${it.name}`;
}

export function makePatch(before: string, after: string, path: string): Fix {
  const rel = path.replace(/^\/+/, "");
  const diff = unifiedDiff(pySplitlines(before, true), pySplitlines(after, true), `a/${rel}`, `b/${rel}`);
  return { kind: "patch", diff };
}

export function checkNames(prog: A.Program): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const tableNames = new Set(prog.items.flatMap((it) => (it.k === "Table" ? [it.name] : [])));
  const bad = (kind: string, name: string, want: string, node: A.Pos) =>
    diags.push(diag("N001", `${kind} '${name}' must be ${want}`, node.line, node.col));
  for (const it of prog.items) {
    if (isExtern(it)) continue;
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
        const msg = effectProblem(e, tableNames);
        if (msg) diags.push(diag("E100", msg, it.line, it.col));
      }
    }
    if (it.k === "Test") {
      for (const e of it.effects) {
        const msg = effectProblem(e, tableNames);
        if (msg) diags.push(diag("E100", msg, it.line, it.col));
      }
    }
    if (it.k === "Fn" || it.k === "Test") {
      for (const s of walkStmts(it.body)) if (s.k === "Let" && !SNAKE.test(s.name)) bad("binding", s.name, "snake_case", s);
    }
  }
  return diags;
}

/** v0.5: a host in net(host): lower-case DNS labels, optionally with a port. */
export const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:[0-9]+)?$/;

/** Why an effect name is not valid, or null. v0.5 adds store(<table>) and net(<host>). */
export function effectProblem(e: string, tableNames: Set<string>): string | null {
  if (EFFECT_SET.has(e)) return null;
  const m = /^([a-z_]+)\((.*)\)$/.exec(e);
  if (m && m[1] === "store") {
    if (tableNames.has(m[2])) return null;
    return `unknown table '${m[2]}' in store(${m[2]})${tableNames.size ? `; the tables are ${[...tableNames].sort(cmpStr).join(", ")}` : "; declare it with table " + m[2] + ": Row key id"}`;
  }
  if (m && m[1] === "net") {
    if (HOST_RE.test(m[2])) return null;
    return `net(${m[2]}) needs a host name, like net(api.example.com)`;
  }
  if (e === "store") return "store needs the table it touches: store(todos)";
  return `unknown effect '${e}'; the effects are ${EFFECTS.join(", ")}`; // the oracle's text
}

/** v0.5: the host of a literal URL, `"https://api.stripe.com/v1"` gives api.stripe.com. */
export function urlHost(raw: string): string | null {
  if (raw.includes("\\")) return null;
  const m = /^"[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:?#"]+)/.exec(raw);
  return m ? m[1].toLowerCase() : null;
}

const NET_CALLS = new Set(["http_get", "http_post"]);
/** Uses a computed URL: satisfied by any declared net effect. */
const NET_ANY = "net(*)";
const isNet = (e: string) => e === "net" || e.startsWith("net(");
const effectBase = (e: string) => e.replace(/\(.*$/, "");

/** Effect lists are exact. Patches are relative to the original source. */
export function checkEffects(
  prog: A.Program,
  src: string,
  path: string,
  tables: EffectTables = ORACLE_TABLES,
  /** Full checker: a function used as a value (map(xs, print)) lends its effects too. */
  countValues = false,
  /** v0.4 (fnEffects): effects each function performs by calling function values, from the type checker. */
  valueCalls?: Map<A.Fn | A.Test, Map<string, string>>,
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const user = new Map<string, Set<string>>();
  for (const it of prog.items) if (it.k === "Fn") user.set(it.name, new Set(it.effects));
  const tableNames = new Set(prog.items.flatMap((x) => (x.k === "Table" ? [x.name] : [])));
  prog.items.forEach((it, idx) => {
    if (it.k !== "Fn" && !(it.k === "Test" && features().sealedEffects)) return;
    if (isExtern(it)) return;
    const used = new Map<string, string>();
    let allKnown = true;
    if (countValues) {
      const all = [...walkExprs(it.body)];
      const callees = new Set(all.filter((e) => e.k === "Call").map((e) => e.callee));
      for (const e of all) {
        if (e.k !== "Name" || callees.has(e) || e.path.length !== 1) continue;
        const n: string = e.path[0];
        const effs = NET_CALLS.has(n) && !user.has(n) ? [NET_ANY]
          : Object.hasOwn(tables.effects, n) ? tables.effects[n] : user.get(n) ?? [];
        for (const ef of effs) if (!used.has(ef)) used.set(ef, `${n} as a value`);
      }
    }
    for (const e of walkExprs(it.body)) {
      if (e.k !== "Call" || e.callee.k !== "Name") continue;
      if (e.callee.path.length !== 1) {
        allKnown = false; // imported module function: effects unknown in v0
        continue;
      }
      const name: string = e.callee.path[0];
      let effs: Iterable<string>;
      const first = e.args[0];
      if (STORE_BUILTINS.has(name) && !user.has(name) && first?.k === "Name" && tableNames.has(first.path[0])) {
        effs = [`store(${first.path[0]})`]; // v0.5
      } else if (countValues && NET_CALLS.has(name) && !user.has(name)) {
        const host = first?.k === "Str" ? urlHost(first.raw) : null;
        effs = [host ? `net(${host})` : NET_ANY]; // v0.5: hosts
      } else if (Object.hasOwn(tables.effects, name)) effs = tables.effects[name];
      else if (user.has(name)) effs = user.get(name)!;
      else if (tables.pure.has(name)) effs = [];
      else {
        allKnown = false;
        effs = [];
      }
      for (const ef of effs) if (!used.has(ef)) used.set(ef, name);
    }
    for (const [ef, via] of valueCalls?.get(it) ?? []) if (!used.has(ef)) used.set(ef, via);
    if (it.k === "Test") {
      // only fs and net are real inside a test; the rest (and store) are virtual and never declared
      for (const k of [...used.keys()]) if (!TEST_REAL_EFFECTS.has(effectBase(k))) used.delete(k);
      allKnown = true;
    }
    const label = itemLabel(it);
    const declared = new Set(it.effects);
    const declaredNet = [...declared].filter(isNet);
    // v0.5: plain net covers every host; a computed URL (net(*)) is covered by any net effect
    const covers = (d: string, u: string) =>
      d === u || (d === "net" && u.startsWith("net(")) || (u === NET_ANY && isNet(d));
    const uncovered = [...used.keys()].filter((u) => ![...declared].some((d) => covers(d, u)));
    const badHosts = uncovered.filter((u) => u !== NET_ANY && u.startsWith("net(") && declaredNet.length > 0);
    const missing = [...new Set(uncovered.filter((u) => !badHosts.includes(u)).map((u) => (u === NET_ANY ? "net" : u)))].sort(cmpStr);
    const extra = allKnown ? [...declared].filter((d) => ![...used.keys()].some((u) => covers(d, u))).sort(cmpStr) : [];
    let fix: Fix | undefined;
    if (missing.length || extra.length) {
      const fixed = [...prog.items];
      const keep = [...declared].filter((d) => !extra.includes(d));
      const all = new Set([...keep, ...missing]);
      fixed[idx] = { ...it, effects: [...all].sort(cmpStr) };
      fix = makePatch(src, programText({ k: "Program", items: fixed }), path);
    }
    for (const u of badHosts) {
      const fixed = [...prog.items];
      fixed[idx] = { ...it, effects: [...new Set([...it.effects, u])].sort(cmpStr) };
      diags.push(diag("E104",
        `${label} calls host ${u.slice(4, -1)} (via ${used.get(u)}), but declares only ${declaredNet.join(", ")}; add ${u}, or declare plain net for any host`,
        it.line, it.col, { fix: makePatch(src, programText({ k: "Program", items: fixed }), path), data: { host: u.slice(4, -1) } }));
    }
    if (missing.length) {
      const via = missing.map((m) => `${m} (via ${used.get(m) ?? used.get(NET_ANY)})`).join(", ");
      diags.push(diag("E101", `${label} uses effects it does not declare: ${via}`, it.line, it.col,
        { fix, data: { missing } }));
    }
    if (extra.length) {
      diags.push(diag("E102",
        it.k === "Fn"
          ? `${label} declares effects it never uses: ${extra.join(", ")} (effect lists are exact)`
          : `${label} declares effects it does not need: ${extra.join(", ")} (tests declare only fs and net)`,
        it.line, it.col, { fix, data: { unused: extra } }));
    }
  });
  return diags;
}

/**
 * v0.3 (sealed effects): requires and ensures must be pure. A contract that performs an effect
 * would act only when contracts are on (`--no-contracts` skips them), so it is E103.
 */
export function checkContractPurity(prog: A.Program, tables: EffectTables): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const user = new Map<string, string[]>();
  for (const it of prog.items) if (it.k === "Fn") user.set(it.name, it.effects);
  const tableNames = new Set(prog.items.flatMap((x) => (x.k === "Table" ? [x.name] : [])));
  const effectsOfName = (n: string) => (Object.hasOwn(tables.effects, n) ? tables.effects[n] : user.get(n) ?? []);
  for (const it of prog.items) {
    if (it.k !== "Fn" || it.extern) continue;
    // v0.4 (fnEffects): a contract that calls a function-typed parameter performs that type's effects
    const paramEffects = new Map<string, string[]>();
    if (features().fnEffects) {
      for (const [n, t] of it.params) if (t.k === "TFn" && t.effects?.length) paramEffects.set(n, t.effects);
    }
    const effectsOf = (n: string) => paramEffects.get(n) ?? effectsOfName(n);
    for (const [clause, e] of [["requires", it.requires], ["ensures", it.ensures]] as const) {
      if (e === null) continue;
      const found = new Map<string, string>();
      for (const x of walkExprs(e)) {
        const n = x.k === "Call" && x.callee.k === "Name" ? x.callee.path[0] : x.k === "Name" && x.path.length === 1 ? x.path[0] : null;
        if (n === null) continue;
        if (x.k === "Call" && STORE_BUILTINS.has(n) && !user.has(n) && x.args[0]?.k === "Name" && tableNames.has(x.args[0].path[0])) {
          const ef = `store(${x.args[0].path[0]})`; // v0.5
          if (!found.has(ef)) found.set(ef, n);
          continue;
        }
        for (const ef of effectsOf(n)) if (!found.has(ef)) found.set(ef, n);
      }
      if (found.size) {
        const via = [...found].map(([ef, n]) => `${ef} (via ${n})`).join(", ");
        diags.push(diag("E103", features().py
          ? `the @${clause} of def ${it.name} performs effects: ${via}; contracts must be pure`
          : `the ${clause} clause of fn ${it.name} performs effects: ${via}; contracts must be pure`,
          it.line, it.col, { data: { effects: [...found.keys()].sort(cmpStr) } }));
      }
    }
  }
  return diags;
}

export function checkHoles(prog: A.Program): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const fns = new Map<string, A.Fn>();
  for (const it of prog.items) if (it.k === "Fn") fns.set(it.name, it);
  const printer = surfacePrinter();
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
    if (it.k !== "Fn" || it.extern) continue;
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
        `hole ${label} in ${itemLabel(it)}: needs a value of type ${want ?? "unknown (v0 infers only returns and call arguments)"}`,
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
  let prog = normalize(parse(src));
  if (features().py) prog = pyNormalize(prog);
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
    const py = isPySource(src);
    const note = py && !features().py
      ? "; this file is Canon-Py: pass --syntax py to check it as Canon-Py, or apply the patch to convert it to brace syntax"
      : !py && features().py && src.trim() !== ""
        ? "; this file is in brace syntax: apply the patch to convert it to Canon-Py, or drop --syntax py"
        : "";
    diags.push(diag("C001",
      `source is not in canonical form; apply the patch (Canon accepts exactly one text per program)${note}`,
      line, 1, { fix: makePatch(src, canonical, path) }));
  }
  pySplitlines(canonical).forEach((l, i) => {
    const len = pyLen(l);
    if (len > MAX_LINE) {
      diags.push(diag("L001", `line is ${len} characters (limit ${MAX_LINE}); ${features().py ? "bind a subexpression to a name" : "bind a subexpression with let"}`,
        i + 1, MAX_LINE + 1));
    }
  });
  return diags;
}

/** Exactly the oracle's check(): the front end only (no types). */
export function checkFront(src: string, path = "main.cn", opts: CompileOptions = {}): CheckResult {
  return withFeatures(opts.features, () => checkFrontInner(src, path));
}

function checkFrontInner(src: string, path: string): CheckResult {
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

export function fmt(src: string, opts: CompileOptions = {}): string {
  return withFeatures(opts.features, () => parseCanonical(src).canonical);
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

/** v0.5: what the project linker hands a module: the items it imports, marked extern. */
export interface ModuleLink {
  externs: A.Item[];
}

export function analyze(src: string, path = "main.cn", opts: CompileOptions = {}, link?: ModuleLink): Analysis {
  return withFeatures(opts.features, () => analyzeInner(src, path, link));
}

function analyzeInner(src: string, path: string, link?: ModuleLink): Analysis {
  let parsed: Parsed;
  try {
    parsed = parseCanonical(src);
  } catch (e) {
    if (e instanceof CanonError) {
      return { result: { ok: false, canonical: false, diagnostics: [e.diag] }, prog: null, info: null };
    }
    throw e;
  }
  const { canonical } = parsed;
  const prog: A.Program = link ? { k: "Program", items: [...parsed.prog.items, ...link.externs] } : parsed.prog;
  const tables = specTables();
  const typed = checkTypes(prog, { project: link !== undefined });
  const effectDiags = checkEffects(prog, src, path, tables, true, typed.info.valueCallEffects);
  for (const [d, fixed] of typed.fixes) d.fix = makePatch(src, programText(fixed), path);
  for (const [d, cands] of typed.suggestions) {
    d.data = { ...(d.data ?? {}), suggestions: cands.map((c) => ({ label: c.label, diff: makePatch(src, programText(c.prog), path).diff })) };
  }
  const typeDiags = typed.diagnostics.filter((d) => d.code !== "H001");
  const holes = typed.diagnostics.filter((d) => d.code === "H001");
  const diags = [
    ...formDiagnostics(src, canonical, path),
    ...checkNames(prog),
    ...typeDiags.filter((d) => d.code === "M001"),
    ...effectDiags,
    ...(features().sealedEffects ? checkContractPurity(prog, tables) : []),
    ...checkApi(prog),
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
export function check(src: string, path = "main.cn", opts: CompileOptions = {}): CheckResult {
  return analyze(src, path, opts).result;
}

// ---------------------------------------------------------------------------
// v0.3: the self-healing loop
// ---------------------------------------------------------------------------

/**
 * Codes whose patch is purely mechanical: applying it never changes what the program means
 * beyond the reported problem. T004's patch is excluded because it inserts holes (questions).
 */
export const MECHANICAL_CODES = ["C001", "E101", "E102", "T009"];

export interface FixResult {
  /** The source after every mechanical patch was applied (canonical when it parses). */
  source: string;
  /** `check` of that source: only judgment errors remain. */
  result: CheckResult;
  /** The code of each patch applied, in order. */
  applied: string[];
}

/**
 * `canon check --fix`: apply mechanical patches one at a time, re-checking after each, until
 * none is left (a fixed point). What is stored is still canonical (design law 1); the agent
 * sees only the diagnostics that need judgment.
 */
export function fix(src: string, path = "main.cn", opts: CompileOptions & { codes?: string[] } = {}): FixResult {
  const allowed = new Set(opts.codes ?? MECHANICAL_CODES);
  let cur = src;
  const applied: string[] = [];
  for (let round = 0; round < 32; round++) {
    const result = check(cur, path, opts);
    const d = result.diagnostics.find((x) => allowed.has(x.code) && x.fix !== undefined);
    if (!d) return { source: cur, result, applied };
    const next = applyPatch(cur, d.fix!.diff);
    if (next === null || next === cur) return { source: cur, result, applied };
    applied.push(d.code);
    cur = next;
  }
  return { source: cur, result: check(cur, path, opts), applied };
}
