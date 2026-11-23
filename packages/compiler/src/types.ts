/**
 * Type checker. Locals are inferred by unification within each function; lambda parameter
 * types come from the expected type at the call site; match must be exhaustive; holes report
 * the type they need. See SPEC.md "Runtime semantics" for the rules.
 */
import type * as A from "./ast.js";
import { walkStmts } from "./ast.js";
import { diag, type Diagnostic } from "./diagnostics.js";
import { features } from "./features.js";
import { parse } from "./parser.js";
import { PRELUDE } from "./prelude.js";
import { Printer } from "./printer.js";
import { PyPrinter, testIdent } from "./pyprinter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Type =
  | { t: "con"; name: string; args: Type[] }
  /** v0.4: `effects` are what calling the function performs (absent or empty: pure). */
  | { t: "fn"; params: Type[]; ret: Type; effects?: string[] }
  | { t: "tuple"; items: Type[] }
  | { t: "var"; id: number; ref: Type | null; key: boolean }
  | { t: "rigid"; name: string };

let nextVar = 0;
export const fresh = (key = false): Type => ({ t: "var", id: nextVar++, ref: null, key });
export const con = (name: string, args: Type[] = []): Type => ({ t: "con", name, args });
export const INT = con("Int");
export const FLOAT = con("Float");
export const BOOL = con("Bool");
export const STRING = con("String");
export const UNIT = con("Unit");

export function prune(t: Type): Type {
  while (t.t === "var" && t.ref) t = t.ref;
  return t;
}

/** Fully resolve a type (follow every bound variable). */
export function resolve(t: Type): Type {
  t = prune(t);
  switch (t.t) {
    case "con":
      return { t: "con", name: t.name, args: t.args.map(resolve) };
    case "fn":
      return { t: "fn", params: t.params.map(resolve), ret: resolve(t.ret), ...(t.effects?.length ? { effects: t.effects } : {}) };
    case "tuple":
      return { t: "tuple", items: t.items.map(resolve) };
    default:
      return t;
  }
}

const PY_NAMES: Record<string, string> = { Int: "int", Float: "float", Bool: "bool", String: "str", List: "list", Map: "dict" };

/** A type as messages show it: brace syntax, or Canon-Py when the py switch is on. */
export function show(t: Type): string {
  t = prune(t);
  const py = features().py;
  switch (t.t) {
    case "con":
      if (py && t.name === "Unit" && t.args.length === 0) return "None";
      return (py ? PY_NAMES[t.name] ?? t.name : t.name) + (t.args.length ? `[${t.args.map(show).join(", ")}]` : "");
    case "fn": {
      const effs = t.effects?.length ? [...t.effects].sort() : [];
      if (py) return `Callable[[${t.params.map(show).join(", ")}], ${show(t.ret)}${effs.length ? `, ${effs.join(" | ")}` : ""}]`;
      return `fn(${t.params.map(show).join(", ")}) -> ${show(t.ret)}${effs.length ? ` effects: ${effs.join(", ")}` : ""}`;
    }
    case "tuple":
      if (py) return `tuple[${t.items.map(show).join(", ")}]`;
      return `(${t.items.map(show).join(", ")})`;
    case "var":
      return "_";
    case "rigid":
      return t.name;
  }
}

function occurs(v: Type, t: Type): boolean {
  t = prune(t);
  if (t === v) return true;
  switch (t.t) {
    case "con":
      return t.args.some((a) => occurs(v, a));
    case "fn":
      return t.params.some((a) => occurs(v, a)) || occurs(v, t.ret);
    case "tuple":
      return t.items.some((a) => occurs(v, a));
    default:
      return false;
  }
}

const KEY_TYPES = new Set(["Int", "Float", "String"]);

function keyOk(t: Type): boolean {
  t = prune(t);
  if (t.t === "var") return true;
  return t.t === "con" && KEY_TYPES.has(t.name) && t.args.length === 0;
}

export function unify(a: Type, b: Type): boolean {
  a = prune(a);
  b = prune(b);
  if (a === b) return true;
  if (a.t === "var") {
    if (occurs(a, b)) return false;
    if (a.key) {
      if (b.t === "var") b.key = true;
      else if (!keyOk(b)) return false;
    }
    a.ref = b;
    return true;
  }
  if (b.t === "var") return unify(b, a);
  if (a.t === "con" && b.t === "con") {
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    return a.args.every((x, i) => unify(x, b.args[i]));
  }
  if (a.t === "fn" && b.t === "fn") {
    if (a.params.length !== b.params.length) return false;
    return a.params.every((x, i) => unify(x, b.params[i])) && unify(a.ret, b.ret);
  }
  if (a.t === "tuple" && b.t === "tuple") {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((x, i) => unify(x, b.items[i]));
  }
  if (a.t === "rigid" && b.t === "rigid") return a.name === b.name;
  return false;
}

/** True when the (pruned) type is a function or contains one: such values have no equality. */
function containsFn(t: Type): boolean {
  t = prune(t);
  if (t.t === "fn") return true;
  if (t.t === "con") return t.args.some(containsFn);
  if (t.t === "tuple") return t.items.some(containsFn);
  return false;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

interface RecordDecl {
  kind: "record";
  name: string;
  params: string[];
  fields: [string, A.TypeExpr][];
}
interface SumDecl {
  kind: "sum";
  name: string;
  params: string[];
  variants: A.Variant[];
}
interface PrimDecl {
  kind: "prim";
  name: string;
  arity: number;
}
type TypeDecl = RecordDecl | SumDecl | PrimDecl;

export interface CtorInfo {
  name: string;
  type: SumDecl;
  fields: [string, A.TypeExpr][];
  index: number;
}

export interface FnSig {
  name: string;
  tparams: string[];
  params: [string, A.TypeExpr][];
  ret: A.TypeExpr;
  effects: string[];
  builtin: boolean;
  node: A.Fn;
}

const PRIMS: PrimDecl[] = [
  { kind: "prim", name: "Int", arity: 0 },
  { kind: "prim", name: "Float", arity: 0 },
  { kind: "prim", name: "Bool", arity: 0 },
  { kind: "prim", name: "String", arity: 0 },
  { kind: "prim", name: "Unit", arity: 0 },
  { kind: "prim", name: "List", arity: 1 },
  { kind: "prim", name: "Map", arity: 2 },
];

interface Prelude {
  types: Map<string, TypeDecl>;
  ctors: Map<string, CtorInfo>;
  fns: Map<string, FnSig>;
}

let preludeCache: Prelude | null = null;

export function prelude(): Prelude {
  if (preludeCache) return preludeCache;
  const prog = parse(PRELUDE);
  const types = new Map<string, TypeDecl>();
  const ctors = new Map<string, CtorInfo>();
  const fns = new Map<string, FnSig>();
  for (const p of PRIMS) types.set(p.name, p);
  for (const it of prog.items) {
    if (it.k === "RecordType") types.set(it.name, { kind: "record", name: it.name, params: it.params, fields: it.fields });
    if (it.k === "SumType") {
      const d: SumDecl = { kind: "sum", name: it.name, params: it.params, variants: it.variants };
      types.set(it.name, d);
      it.variants.forEach(([vn, fs], index) => ctors.set(vn, { name: vn, type: d, fields: fs, index }));
    }
    if (it.k === "Fn") {
      fns.set(it.name, { name: it.name, tparams: it.tparams, params: it.params, ret: it.ret, effects: it.effects, builtin: true, node: it });
    }
  }
  preludeCache = { types, ctors, fns };
  return preludeCache;
}

/** Built-in effect table derived from the prelude (the spec's standard library). */
export function builtinEffects(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of prelude().fns.values()) if (f.effects.length) out[f.name] = f.effects;
  return out;
}

export function pureBuiltins(): Set<string> {
  return new Set([...prelude().fns.values()].filter((f) => !f.effects.length).map((f) => f.name));
}

// ---------------------------------------------------------------------------
// Results for code generation
// ---------------------------------------------------------------------------

export type CallKind = "user" | "builtin" | "local" | "ctor";

export interface TypeInfo {
  /** The type of every expression node that was checked. */
  types: Map<A.Expr, Type>;
  /** How each call's callee resolved. */
  calls: Map<A.Call, CallKind>;
  /** How each bare name resolved (a function used as a value, or a local). */
  names: Map<A.Name, "local" | "user" | "builtin">;
  /** Lambdas that receive one n-tuple and unpack it into n parameters. */
  unpack: Set<A.Lambda>;
  ctors: Map<string, CtorInfo>;
  records: Map<string, RecordDecl>;
  userFns: Map<string, FnSig>;
  /**
   * v0.4 (fnEffects): effects each function or test performs by calling function values (a
   * parameter, a local or a field whose function type declares effects), with the name called.
   */
  valueCallEffects: Map<A.Fn | A.Test, Map<string, string>>;
}

export interface TypeResult {
  diagnostics: Diagnostic[];
  info: TypeInfo;
  /** Programs that a mechanical fix would produce, keyed by diagnostic. */
  fixes: Map<Diagnostic, A.Program>;
  /** v0.3: ranked candidate fixes for judgment errors (not applied automatically). */
  suggestions: Map<Diagnostic, { label: string; prog: A.Program }[]>;
}

// ---------------------------------------------------------------------------
// Checker
// ---------------------------------------------------------------------------

interface Binding {
  type: Type;
  mutable: boolean;
}

interface FnCtx {
  label: string; // "fn name" or "test \"name\""
  fnName: string | null;
  ret: Type;
  isTest: boolean;
  scopes: Map<string, Binding>[];
  lambdaDepth: number;
  /** v0.3: how many loops enclose the current statement (break needs one). */
  loopDepth: number;
  holes: { node: A.Hole; type: Type }[];
  /** v0.4: the function or test being checked. */
  item: A.Fn | A.Test;
  /** v0.4: effects performed inside each enclosing lambda body (innermost last). */
  effStack: Set<string>[];
}

/** Prints expressions and patterns in messages, in the active surface. */
const tyPrinter = {
  ex: (e: A.Expr, min = 0) => (features().py ? new PyPrinter().ex(e, min) : new Printer().ex(e, min)),
  pat: (p: A.Pattern) => (features().py ? new PyPrinter().pat(p) : new Printer().pat(p)),
};
/** How a message tells the agent to build a record, in the active surface. */
const recordHint = (name: string) => (features().py ? `${name}(field=value, ...)` : `${name} { ... }`);

/** Canon-Py: a hint when a name is unknown because it was bound in an inner block. */
function scopeHint(item: A.Fn | A.Test, name: string): string {
  if (!features().py) return "";
  for (const s of walkStmts(item.body)) {
    if (s.k === "Let" && s.name === name) {
      return `; ${name} is bound inside a block above, and names live only in the block that binds them: bind ${name} before that block (for example ${name} = 0) and assign it inside`;
    }
  }
  return "";
}

const ESCAPE_RE =/\\(.)/g;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function exprPos(e: A.Expr): A.Pos {
  // Binary nodes carry no position in the oracle's AST; use their leftmost operand.
  let cur: A.Expr = e;
  while ((cur.line === 0 || cur.line === undefined) && cur.k === "Binary") cur = cur.left;
  return { line: cur.line, col: cur.col };
}

function replaceNode<T>(root: T, target: object, replacement: object): T {
  const visit = (v: any): any => {
    if (v === target) return replacement;
    if (Array.isArray(v)) {
      let changed = false;
      const out = v.map((x) => {
        const y = visit(x);
        if (y !== x) changed = true;
        return y;
      });
      return changed ? out : v;
    }
    if (v && typeof v === "object") {
      let changed = false;
      const out: any = {};
      for (const key of Object.keys(v)) {
        const y = visit(v[key]);
        if (y !== v[key]) changed = true;
        out[key] = y;
      }
      return changed ? out : v;
    }
    return v;
  };
  return visit(root);
}

export function checkTypes(prog: A.Program): TypeResult {
  const pre = prelude();
  const diags: Diagnostic[] = [];
  const fixes = new Map<Diagnostic, A.Program>();
  const suggestions = new Map<Diagnostic, { label: string; prog: A.Program }[]>();
  const types = new Map<string, TypeDecl>(pre.types);
  const ctors = new Map<string, CtorInfo>(pre.ctors);
  const records = new Map<string, RecordDecl>();
  for (const t of pre.types.values()) if (t.kind === "record") records.set(t.name, t);
  const userFns = new Map<string, FnSig>();
  const info: TypeInfo = {
    types: new Map(),
    calls: new Map(),
    names: new Map(),
    unpack: new Set(),
    ctors,
    records,
    userFns,
    valueCallEffects: new Map(),
  };

  const err = (code: string, message: string, pos: A.Pos) => {
    const d = diag(code, message, pos.line, pos.col);
    diags.push(d);
    return d;
  };

  // -- modules
  for (const it of prog.items) {
    if (it.k === "Use" && !(it.path[0] === "std" && it.path.length === 2)) {
      err("M001", `use ${it.path.join(".")}: modules arrive in v1; only std.<name> is available in v0`, it);
    }
  }

  // -- collect declarations
  for (const it of prog.items) {
    if (it.k === "RecordType" || it.k === "SumType") {
      if (pre.types.has(it.name)) {
        err("T001", `type ${it.name} is built in and cannot be redefined`, it);
        continue;
      }
      if (types.has(it.name)) {
        err("T001", `type ${it.name} is declared twice`, it);
        continue;
      }
      if (it.k === "RecordType") {
        const d: RecordDecl = { kind: "record", name: it.name, params: it.params, fields: it.fields };
        types.set(it.name, d);
        records.set(it.name, d);
        const seen = new Set<string>();
        for (const [f] of it.fields) {
          if (seen.has(f)) err("T001", `field ${f} is declared twice in type ${it.name}`, it);
          seen.add(f);
        }
      } else {
        const d: SumDecl = { kind: "sum", name: it.name, params: it.params, variants: it.variants };
        types.set(it.name, d);
        it.variants.forEach(([vn, fs], index) => {
          if (ctors.has(vn)) err("T001", `variant ${vn} is already defined`, it);
          else ctors.set(vn, { name: vn, type: d, fields: fs, index });
        });
      }
    }
  }
  for (const it of prog.items) {
    if (it.k !== "Fn") continue;
    if (pre.fns.has(it.name)) {
      err("T001", `fn ${it.name} is a built-in; choose another name`, it);
      continue;
    }
    if (userFns.has(it.name)) {
      err("T001", `fn ${it.name} is declared twice`, it);
      continue;
    }
    userFns.set(it.name, { name: it.name, tparams: it.tparams, params: it.params, ret: it.ret, effects: it.effects, builtin: false, node: it });
  }

  // -- type expressions
  const toType = (te: A.TypeExpr, scope: Map<string, Type>, report = true): Type => {
    switch (te.k) {
      case "TFn":
        return {
          t: "fn", params: te.params.map((p) => toType(p, scope, report)), ret: toType(te.ret, scope, report),
          ...(te.effects?.length && features().fnEffects ? { effects: [...new Set(te.effects)].sort() } : {}),
        };
      case "TTuple":
        return { t: "tuple", items: te.items.map((p) => toType(p, scope, report)) };
      case "TName": {
        const bound = scope.get(te.name);
        if (bound) {
          if (te.args.length && report) err("T001", `type parameter ${te.name} takes no arguments`, te);
          return bound;
        }
        const d = types.get(te.name);
        if (!d) {
          if (report) err("T002", `unknown type ${te.name}`, te);
          return fresh();
        }
        const arity = d.kind === "prim" ? d.arity : d.params.length;
        if (te.args.length !== arity) {
          if (report) err("T001", `type ${te.name} takes ${arity} type argument${arity === 1 ? "" : "s"}, got ${te.args.length}`, te);
          return fresh();
        }
        return con(te.name, te.args.map((a) => toType(a, scope, report)));
      }
    }
  };

  // validate declared types once
  for (const it of prog.items) {
    if (it.k === "RecordType" || it.k === "SumType") {
      if (types.get(it.name) === undefined) continue;
      const scope = new Map(it.params.map((p) => [p, { t: "rigid", name: p } as Type]));
      if (it.k === "RecordType") for (const [, t] of it.fields) toType(t, scope);
      else for (const [, fs] of it.variants) for (const [, t] of fs) toType(t, scope);
    }
  }

  const instantiateSig = (sig: FnSig): { params: Type[]; ret: Type } => {
    const scope = new Map(sig.tparams.map((p) => [p, fresh(sig.builtin && p === "K")]));
    return { params: sig.params.map(([, t]) => toType(t, scope, false)), ret: toType(sig.ret, scope, false) };
  };

  const instantiateCtor = (c: CtorInfo): { fields: Type[]; result: Type } => {
    const args = c.type.params.map(() => fresh());
    const scope = new Map(c.type.params.map((p, i) => [p, args[i]]));
    return { fields: c.fields.map(([, t]) => toType(t, scope, false)), result: con(c.type.name, args) };
  };

  const instantiateRecord = (r: RecordDecl): { fields: Map<string, Type>; result: Type } => {
    const args = r.params.map(() => fresh());
    const scope = new Map(r.params.map((p, i) => [p, args[i]]));
    return { fields: new Map(r.fields.map(([n, t]) => [n, toType(t, scope, false)])), result: con(r.name, args) };
  };

  const fieldsOf = (t: Type): Map<string, Type> | null => {
    t = prune(t);
    if (t.t !== "con") return null;
    const r = records.get(t.name);
    if (!r) return null;
    const scope = new Map(r.params.map((p, i) => [p, t.args[i]]));
    return new Map(r.fields.map(([n, ft]) => [n, toType(ft, scope, false)]));
  };

  // -- function bodies
  let ctx: FnCtx;

  const lookup = (name: string): Binding | undefined => {
    for (let i = ctx.scopes.length - 1; i >= 0; i--) {
      const b = ctx.scopes[i].get(name);
      if (b) return b;
    }
    return undefined;
  };
  const bind = (name: string, type: Type, mutable = false) => ctx.scopes[ctx.scopes.length - 1].set(name, { type, mutable });
  const withScope = <T>(f: () => T): T => {
    ctx.scopes.push(new Map());
    try {
      return f();
    } finally {
      ctx.scopes.pop();
    }
  };

  const mismatch = (pos: A.Pos, want: Type, got: Type, what = "", node?: A.Expr, fixTarget?: [A.Expr, Type, Type]) => {
    const d = err("T001", `type mismatch${what ? ` in ${what}` : ""}: expected ${show(want)}, found ${show(got)}`, pos);
    const [n, w, g] = fixTarget ?? [node, want, got];
    if (n && features().suggestions) {
      const cands = suggest(w, g, n);
      if (cands.length) suggestions.set(d, cands.map((c) => ({ label: tyPrinter.ex(c, 0), prog: replaceNode(prog, n, c) })));
    }
    return d;
  };

  /**
   * An Int expression as a Float. Wrapping an integer division whole (`to_float(a / b)`) would keep
   * its truncation, so a division (and any + - * around one) converts its operands instead:
   * `a / b` becomes `to_float(a) / to_float(b)`.
   */
  const floatOf = (e: A.Expr): A.Expr => {
    const hasDiv = (x: A.Expr): boolean =>
      x.k === "Binary" && ["+", "-", "*", "/"].includes(x.op) && (x.op === "/" || hasDiv(x.left) || hasDiv(x.right));
    if (e.k === "Binary" && hasDiv(e)) return { ...e, left: floatOf(e.left), right: floatOf(e.right) };
    return { k: "Call", callee: { k: "Name", path: ["to_float"], line: 0, col: 0 }, args: [e], line: 0, col: 0 };
  };

  /**
   * v0.3: candidate rewrites of an expression whose type is wrong, most likely first. Each is
   * a conversion an agent would otherwise have to look up; none is applied automatically.
   */
  const suggest = (wantT: Type, gotT: Type, node: A.Expr): A.Expr[] => {
    const want = prune(wantT);
    const got = prune(gotT);
    const call = (name: string, ...args: A.Expr[]): A.Expr => ({
      k: "Call", callee: { k: "Name", path: [name], line: 0, col: 0 }, args, line: 0, col: 0,
    });
    const ctor = (name: string, arg: A.Expr): A.Expr => ({
      k: "Call", callee: { k: "Ctor", name, line: 0, col: 0 }, args: [arg], line: 0, col: 0,
    });
    const hole: A.Hole = { k: "Hole", name: "", line: 0, col: 0 };
    const is = (t: Type, name: string) => t.t === "con" && t.name === name;
    const out: A.Expr[] = [];
    if (is(want, "String") && (is(got, "Int") || is(got, "Float") || is(got, "Bool"))) out.push(call("to_string", node));
    if (is(want, "Float") && is(got, "Int")) out.push(floatOf(node));
    if (is(want, "Int") && is(got, "Float")) out.push(call("to_int", node));
    if (got.t === "con" && got.name === "Option" && show(got.args[0]) === show(want)) out.push(call("unwrap_or", node, hole));
    if (want.t === "con" && want.name === "Option" && !is(got, "Option") && show(want.args[0]) === show(got)) out.push(ctor("Some", node));
    if (want.t === "con" && want.name === "Result" && !is(got, "Result") && show(want.args[0]) === show(got)) out.push(ctor("Ok", node));
    if (want.t === "con" && want.name === "List" && !is(got, "List") && show(want.args[0]) === show(got)) {
      out.push({ k: "ListLit", items: [node], line: 0, col: 0 });
    }
    return out;
  };

  /**
   * v0.4 (fnEffects): calling a function performs its effects. Inside a lambda they become the
   * lambda's effects; a call of a function value also counts for the enclosing function or test.
   */
  const noteEffects = (effs: string[] | undefined, via: string, valueCall: boolean) => {
    if (!effs?.length || !features().fnEffects) return;
    for (const s of ctx.effStack) for (const ef of effs) s.add(ef);
    if (!valueCall) return;
    let m = info.valueCallEffects.get(ctx.item);
    if (!m) info.valueCallEffects.set(ctx.item, (m = new Map()));
    for (const ef of effs) if (!m.has(ef)) m.set(ef, via);
  };

  /** Effects a value's function types perform beyond what the expected type allows. */
  const extraEffects = (actual: Type, want: Type): string[] => {
    const a = prune(actual);
    const w = prune(want);
    if (a.t === "fn" && w.t === "fn") {
      const allowed = new Set(w.effects ?? []);
      const own = (a.effects ?? []).filter((x) => !allowed.has(x));
      const inner = a.ret !== w.ret ? extraEffects(a.ret, w.ret) : [];
      return [...new Set([...own, ...inner])].sort();
    }
    if (a.t === "con" && w.t === "con" && a.name === w.name && a.args.length === w.args.length) {
      return [...new Set(a.args.flatMap((x, i) => extraEffects(x, w.args[i])))].sort();
    }
    if (a.t === "tuple" && w.t === "tuple" && a.items.length === w.items.length) {
      return [...new Set(a.items.flatMap((x, i) => extraEffects(x, w.items[i])))].sort();
    }
    return [];
  };

  /** v0.4 (fnEffects): an effectful function cannot flow where the function type is pure (T011). */
  const fitEffects = (actual: Type, want: Type | null, node: A.Expr, label: string) => {
    if (!features().fnEffects || want === null) return;
    const extra = extraEffects(actual, want);
    if (!extra.length) return;
    const how = features().py
      ? `declare them in that type, e.g. Callable[[str], None, ${extra.join(" | ")}]`
      : `declare them in that type, e.g. fn(String) -> Unit effects: ${extra.join(", ")}`;
    err("T011", `${label} performs ${extra.join(", ")}, but it is used where the function type ${show(want)} allows no such effects; ${how}`,
      exprPos(node));
  };

  /** Unify `got` into `want`, reporting T001 at pos on failure. */
  const expectType = (pos: A.Pos, want: Type | null, got: Type, what = "", node?: A.Expr): Type => {
    if (want === null) return got;
    if (!unify(want, got)) {
      mismatch(pos, want, got, what, node);
      return want;
    }
    return want;
  };

  const isPrim = (t: Type, name: string) => {
    t = prune(t);
    return t.t === "con" && t.name === name;
  };

  const numericOrVar = (t: Type) => {
    t = prune(t);
    return t.t === "var" || isPrim(t, "Int") || isPrim(t, "Float");
  };

  /** Report T009 with a patch that converts the Int operand with to_float (see floatOf). */
  const t009 = (e: A.Binary, intSide: A.Expr) => {
    const d = err("T009", `operator ${e.op} mixes Int and Float; convert the Int side with to_float`, exprPos(e));
    fixes.set(d, replaceNode(prog, intSide, floatOf(intSide)));
  };

  const checkEscapes = (e: A.StrLit) => {
    for (const m of e.raw.slice(1, -1).matchAll(ESCAPE_RE)) {
      if (!['"', "\\", "n", "t"].includes(m[1])) {
        err("T001", `unknown escape \\${m[1]} in string; the escapes are \\" \\\\ \\n \\t`, e);
        return;
      }
    }
  };

  const callFn = (call: A.Call, params: Type[], ret: Type, label: string, expected: Type | null): Type => {
    if (call.args.length !== params.length) {
      err("T003", `${label} takes ${params.length} argument${params.length === 1 ? "" : "s"}, got ${call.args.length}`, call);
      for (const a of call.args) expr(a, null);
      return expected ?? ret;
    }
    // non-lambda arguments first, so lambdas see resolved parameter types
    call.args.forEach((a, i) => {
      if (a.k !== "Lambda") expr(a, params[i], `argument ${i + 1} of ${label}`);
    });
    call.args.forEach((a, i) => {
      if (a.k === "Lambda") expr(a, params[i], `argument ${i + 1} of ${label}`);
    });
    return ret;
  };

  const expr = (e: A.Expr, expected: Type | null, what = ""): Type => {
    const t = exprInner(e, expected, what);
    info.types.set(e, t);
    return t;
  };

  const exprInner = (e: A.Expr, expected: Type | null, what: string): Type => {
    const pos = exprPos(e);
    switch (e.k) {
      case "Int":
        if (BigInt(e.value) > MAX_SAFE) err("T001", `integer literal ${e.value} is outside the 53-bit safe range`, e);
        return expectType(pos, expected, INT, what, e);
      case "Float":
        return expectType(pos, expected, FLOAT, what, e);
      case "Str":
        checkEscapes(e);
        return expectType(pos, expected, STRING, what, e);
      case "Bool":
        return expectType(pos, expected, BOOL, what, e);
      case "Hole": {
        const t = expected ?? fresh();
        ctx.holes.push({ node: e, type: t });
        return t;
      }
      case "Name": {
        if (e.path.length > 1) {
          err("T002", `unknown name ${e.path.join(".")}: module functions arrive in v1`, e);
          return expected ?? fresh();
        }
        const name = e.path[0];
        const b = lookup(name);
        if (b) {
          info.names.set(e, "local");
          fitEffects(b.type, expected, e, name);
          return expectType(pos, expected, b.type, what, e);
        }
        const sig = userFns.get(name) ?? pre.fns.get(name);
        if (sig) {
          info.names.set(e, sig.builtin ? "builtin" : "user");
          const inst = instantiateSig(sig);
          const fnT: Type = {
            t: "fn", params: inst.params, ret: inst.ret,
            ...(sig.effects.length && features().fnEffects ? { effects: [...sig.effects].sort() } : {}),
          };
          fitEffects(fnT, expected, e, name);
          return expectType(pos, expected, fnT, what, e);
        }
        err("T002", `unknown name ${name}${scopeHint(ctx.item, name)}`, e);
        return expected ?? fresh();
      }
      case "Ctor": {
        const c = ctors.get(e.name);
        if (!c) {
          err("T002", records.has(e.name) ? `${e.name} is a record type; build it with ${recordHint(e.name)}` : `unknown variant ${e.name}`, e);
          return expected ?? fresh();
        }
        if (c.fields.length) {
          err("T003", `variant ${e.name} takes ${c.fields.length} argument${c.fields.length === 1 ? "" : "s"}, got 0`, e);
          return expected ?? fresh();
        }
        return expectType(pos, expected, instantiateCtor(c).result, what, e);
      }
      case "Call":
        return expectType(pos, expected, call(e, expected), what, e);
      case "FieldGet": {
        const objT = prune(expr(e.obj, null));
        if (objT.t === "tuple") {
          const i = /^\d+$/.test(e.name) ? Number(e.name) : -1;
          if (i < 0 || i >= objT.items.length) {
            err("T008", `tuple ${show(objT)} has no slot ${e.name}`, e);
            return expected ?? fresh();
          }
          return expectType(pos, expected, objT.items[i], what, e);
        }
        if (objT.t === "var") {
          err("T001", `cannot infer the type before .${e.name}; it is used before its type is known`, e);
          return expected ?? fresh();
        }
        const fields = fieldsOf(objT);
        const ft = fields?.get(e.name);
        if (!ft) {
          err("T008", features().py && /^\d+$/.test(e.name)
            ? `${show(objT)} has no slot [${e.name}]: only tuples are indexed; for a list use first, last, take or drop, or a for loop`
            : `type ${show(objT)} has no field ${e.name}`, e);
          return expected ?? fresh();
        }
        return expectType(pos, expected, ft, what, e);
      }
      case "Unary": {
        if (e.op === "not") {
          expr(e.operand, BOOL, "not");
          return expectType(pos, expected, BOOL, what, e);
        }
        const t = expr(e.operand, null);
        if (!numericOrVar(t)) {
          err("T001", `unary - needs Int or Float, found ${show(t)}`, e);
          return expected ?? fresh();
        }
        return expectType(pos, expected, t, what, e);
      }
      case "Binary":
        return expectType(pos, expected, binary(e), what, e);
      case "Try": {
        if (ctx.lambdaDepth > 0) {
          err("T007", features().py
            ? "? cannot be used inside a lambda; bind the Result to a name first"
            : "try cannot be used inside a lambda; bind the Result with let first", e);
          expr(e.expr, null);
          return expected ?? fresh();
        }
        const r = prune(ctx.ret);
        if (ctx.isTest || r.t !== "con" || r.name !== "Result") {
          err("T007", `${features().py ? "?" : "try"} needs the enclosing ${ctx.label} to return a Result`, e);
          expr(e.expr, null);
          return expected ?? fresh();
        }
        const inner = prune(expr(e.expr, null));
        const val = fresh();
        const errT = fresh();
        if (!unify(inner, con("Result", [val, errT]))) {
          err("T007", `${features().py ? "?" : "try"} needs a Result, found ${show(inner)}`, e);
          return expected ?? fresh();
        }
        if (!unify(errT, r.args[1])) {
          err("T007", `${features().py ? "?" : "try"} returns error type ${show(errT)} early, but ${ctx.label} returns ${show(r)}`, e);
        }
        return expectType(pos, expected, val, what, e);
      }
      case "Lambda": {
        const exp = expected ? prune(expected) : null;
        let params: Type[];
        let ret: Type;
        let unpackTuple: Type[] | null = null;
        if (exp && exp.t === "fn") {
          if (exp.params.length === e.params.length) {
            params = exp.params;
          } else {
            const only = exp.params.length === 1 ? prune(exp.params[0]) : null;
            if (only && only.t === "tuple" && only.items.length === e.params.length && e.params.length >= 2) {
              unpackTuple = only.items;
              params = only.items;
              info.unpack.add(e);
            } else {
              err("T003", `lambda takes ${e.params.length} parameter${e.params.length === 1 ? "" : "s"}, but ${exp.params.length} ${exp.params.length === 1 ? "is" : "are"} expected here`, e);
              params = e.params.map(() => fresh());
            }
          }
          ret = exp.ret;
        } else {
          params = e.params.map(() => fresh());
          ret = fresh();
        }
        ctx.lambdaDepth++;
        const performed = new Set<string>();
        ctx.effStack.push(performed);
        withScope(() => {
          e.params.forEach((p, i) => bind(p, params[i]));
          expr(e.body, ret, "lambda body");
        });
        ctx.effStack.pop();
        ctx.lambdaDepth--;
        const fnT: Type = {
          t: "fn", params: unpackTuple ? [{ t: "tuple", items: unpackTuple }] : params, ret,
          ...(performed.size ? { effects: [...performed].sort() } : {}),
        };
        fitEffects(fnT, expected, e, "this lambda");
        if (exp && exp.t !== "fn") return expectType(pos, expected, fnT, what, e);
        return exp && exp.t === "fn" ? exp : fnT;
      }
      case "ListLit": {
        const elem = fresh();
        if (expected) expectType(pos, expected, con("List", [elem]), what, e);
        e.items.forEach((x) => expr(x, elem, "list item"));
        return expected ?? con("List", [elem]);
      }
      case "TupleLit": {
        const exp = expected ? prune(expected) : null;
        const items = e.items.map((x, i) =>
          expr(x, exp && exp.t === "tuple" && exp.items.length === e.items.length ? exp.items[i] : null));
        return expectType(pos, expected, { t: "tuple", items }, what, e);
      }
      case "Record": {
        const r = records.get(e.tname);
        if (!r) {
          err("T002", ctors.has(e.tname) ? `${e.tname} is a variant; build it with ${e.tname}(...)` : `unknown record type ${e.tname}`, e);
          for (const [, v] of e.fields) expr(v, null);
          return expected ?? fresh();
        }
        const inst = instantiateRecord(r);
        if (expected) unify(expected, inst.result);
        const seen = new Set<string>();
        for (const [n, v] of e.fields) {
          const ft = inst.fields.get(n);
          if (!ft) {
            err("T008", `type ${r.name} has no field ${n}`, v);
            expr(v, null);
            continue;
          }
          if (seen.has(n)) err("T001", `field ${n} is given twice`, v);
          seen.add(n);
          expr(v, ft, `field ${n}`);
        }
        const missing = r.fields.map(([n]) => n).filter((n) => !seen.has(n));
        if (missing.length) err("T001", `${r.name} literal is missing field${missing.length === 1 ? "" : "s"} ${missing.join(", ")}`, e);
        return expectType(pos, expected, inst.result, what, e);
      }
      case "Match":
        return match(e, expected);
    }
  };

  const call = (e: A.Call, expected: Type | null): Type => {
    const callee = e.callee;
    if (callee.k === "Ctor") {
      info.calls.set(e, "ctor");
      const c = ctors.get(callee.name);
      if (!c) {
        err("T002", records.has(callee.name) ? `${callee.name} is a record type; build it with ${recordHint(callee.name)}` : `unknown variant ${callee.name}`, callee);
        for (const a of e.args) expr(a, null);
        return expected ?? fresh();
      }
      const inst = instantiateCtor(c);
      if (expected) unify(expected, inst.result);
      return callFn(e, inst.fields, inst.result, `variant ${c.name}`, expected);
    }
    if (callee.path.length > 1) {
      const head = callee.path[0];
      const fnName = callee.path[callee.path.length - 1];
      err("T002", lookup(head)
        ? `${callee.path.join(".")} is not a function: Canon has no methods; call ${fnName}(${head}, ...) instead`
        : `unknown function ${callee.path.join(".")}: module functions arrive in v1`, callee);
      for (const a of e.args) expr(a, null);
      return expected ?? fresh();
    }
    const name = callee.path[0];
    const local = lookup(name);
    if (local) {
      info.calls.set(e, "local");
      let ft = prune(local.type);
      if (ft.t === "var") {
        const guess: Type = { t: "fn", params: e.args.map(() => fresh()), ret: fresh() };
        unify(ft, guess);
        ft = guess;
      }
      if (ft.t !== "fn") {
        err("T001", `${name} is a ${show(ft)}, not a function`, callee);
        for (const a of e.args) expr(a, null);
        return expected ?? fresh();
      }
      noteEffects(ft.effects, name, true);
      return callFn(e, ft.params, ft.ret, name, expected);
    }
    const sig = userFns.get(name) ?? pre.fns.get(name);
    if (!sig) {
      err("T002", `unknown function ${name}`, callee);
      for (const a of e.args) expr(a, null);
      return expected ?? fresh();
    }
    info.calls.set(e, sig.builtin ? "builtin" : "user");
    noteEffects(sig.effects, name, false);
    const inst = instantiateSig(sig);
    fitEffects(inst.ret, expected, e, `the function ${name} returns, which`);
    if (expected) unify(expected, inst.ret);
    const before = diags.length;
    const ret = callFn(e, inst.params, inst.ret, name, expected);
    // key type parameters (K) must resolve to Int, Float or String
    if (sig.builtin && diags.length === before && sig.tparams.includes("K")) {
      const scopeK = inst.params.flatMap(collectKeyVars);
      for (const k of scopeK) {
        const r = prune(k);
        if (r.t !== "var" && !keyOk(r)) {
          err("T001", `${name} needs keys of type Int, Float or String, found ${show(r)}`, e);
          break;
        }
      }
    }
    return ret;
  };

  const collectKeyVars = (t: Type): Type[] => {
    if (t.t === "var") return t.key ? [t] : t.ref ? collectKeyVars(t.ref) : [];
    if (t.t === "con") return t.args.flatMap(collectKeyVars);
    if (t.t === "fn") return [...t.params.flatMap(collectKeyVars), ...collectKeyVars(t.ret)];
    if (t.t === "tuple") return t.items.flatMap(collectKeyVars);
    return [];
  };

  const binary = (e: A.Binary): Type => {
    const op = e.op;
    if (op === "and" || op === "or") {
      expr(e.left, BOOL, `left side of ${op}`);
      expr(e.right, BOOL, `right side of ${op}`);
      return BOOL;
    }
    const l = expr(e.left, null);
    const r = expr(e.right, null);
    const lp = prune(l);
    const rp = prune(r);
    if ((isPrim(lp, "Int") && isPrim(rp, "Float")) || (isPrim(lp, "Float") && isPrim(rp, "Int"))) {
      t009(e, isPrim(lp, "Int") ? e.left : e.right);
      return ["+", "-", "*", "/", "%"].includes(op) ? FLOAT : BOOL;
    }
    if (op === "==" || op === "!=") {
      if (!unify(l, r)) mismatch(exprPos(e), l, r, `operands of ${op}`);
      else if (containsFn(l)) err("T001", `functions cannot be compared with ${op}`, exprPos(e));
      return BOOL;
    }
    const arith = ["+", "-", "*", "/", "%"].includes(op);
    // v0.2: + also joins strings
    const allowed = op === "+" ? ["Int", "Float", "String"] : arith ? ["Int", "Float"] : ["Int", "Float", "String"];
    for (const [side, t] of [[e.left, lp], [e.right, rp]] as const) {
      if (t.t !== "var" && !(t.t === "con" && allowed.includes(t.name) && t.args.length === 0)) {
        const want = op === "+" ? "Int, Float or String" : arith ? "Int or Float" : "Int, Float or String";
        err("T001", `operator ${op} needs ${want} operands, found ${show(t)}`, exprPos(side));
        return arith ? fresh() : BOOL;
      }
    }
    if (!unify(l, r)) {
      // "n = " + n: the likely fix converts the non-String side with to_string
      const strL = isPrim(lp, "String");
      const target: [A.Expr, Type, Type] | undefined =
        op === "+" && strL !== isPrim(rp, "String") ? (strL ? [e.right, STRING, rp] : [e.left, STRING, lp]) : undefined;
      mismatch(exprPos(e), l, r, `operands of ${op}`, undefined, target);
      return arith ? fresh() : BOOL;
    }
    return arith ? l : BOOL;
  };

  // -- patterns and exhaustiveness
  const pattern = (p: A.Pattern, t: Type): void => {
    switch (p.k) {
      case "PWild":
        return;
      case "PBind":
        bind(p.name, t);
        return;
      case "PLit": {
        const lt = expr(p.lit, null);
        if (!unify(t, lt)) mismatch(p, t, lt, "pattern");
        return;
      }
      case "PCtor": {
        const c = ctors.get(p.name);
        if (!c) {
          err("T002", `unknown variant ${p.name}`, p);
          return;
        }
        const inst = instantiateCtor(c);
        if (!unify(t, inst.result)) {
          mismatch(p, t, inst.result, "pattern");
          return;
        }
        if (p.args.length !== inst.fields.length) {
          err("T003", `pattern ${p.name} takes ${inst.fields.length} argument${inst.fields.length === 1 ? "" : "s"}, got ${p.args.length}`, p);
          return;
        }
        p.args.forEach((a, i) => pattern(a, inst.fields[i]));
        return;
      }
      case "PTuple": {
        const items = p.items.map(() => fresh());
        if (!unify(t, { t: "tuple", items })) {
          mismatch(p, t, { t: "tuple", items }, "pattern");
          return;
        }
        p.items.forEach((a, i) => pattern(a, items[i]));
        return;
      }
    }
  };

  type Ctor = { key: string; arity: number; argTypes: Type[]; build: (args: A.Pattern[]) => A.Pattern };
  const WILD: A.Pattern = { k: "PWild", line: 0, col: 0 };

  const ctorsOf = (t: Type): Ctor[] | null => {
    t = prune(t);
    if (isPrim(t, "Bool")) {
      return [true, false].map((v) => ({
        key: String(v),
        arity: 0,
        argTypes: [],
        build: () => ({ k: "PLit", lit: { k: "Bool", value: v, line: 0, col: 0 }, line: 0, col: 0 }),
      }));
    }
    if (t.t === "tuple") {
      return [{ key: "()", arity: t.items.length, argTypes: t.items, build: (args) => ({ k: "PTuple", items: args, line: 0, col: 0 }) }];
    }
    if (t.t === "con") {
      const d = types.get(t.name);
      if (d && d.kind === "sum") {
        const scope = new Map(d.params.map((p, i) => [p, t.args[i]]));
        return d.variants.map(([vn, fs]) => ({
          key: vn,
          arity: fs.length,
          argTypes: fs.map(([, ft]) => toType(ft, scope, false)),
          build: (args) => ({ k: "PCtor", name: vn, args, line: 0, col: 0 }),
        }));
      }
    }
    return null;
  };

  const headKey = (p: A.Pattern): string | null => {
    switch (p.k) {
      case "PWild":
      case "PBind":
        return null;
      case "PLit":
        return p.lit.k === "Bool" ? String(p.lit.value) : `lit:${tyPrinter.ex(p.lit)}`;
      case "PCtor":
        return p.name;
      case "PTuple":
        return "()";
    }
  };

  const subPatterns = (p: A.Pattern, arity: number): A.Pattern[] => {
    if (p.k === "PCtor") return p.args.length === arity ? p.args : Array(arity).fill(WILD);
    if (p.k === "PTuple") return p.items.length === arity ? p.items : Array(arity).fill(WILD);
    return Array(arity).fill(WILD);
  };

  /** A pattern vector no row matches, or null when the rows are exhaustive. */
  const witness = (rows: A.Pattern[][], tys: Type[]): A.Pattern[] | null => {
    if (tys.length === 0) return rows.length === 0 ? [] : null;
    const cs = ctorsOf(tys[0]);
    const present = new Set(rows.map((r) => headKey(r[0])).filter((k): k is string => k !== null));
    if (cs && cs.every((c) => present.has(c.key))) {
      // the heads name every constructor: split on each one
      for (const c of cs) {
        const spec: A.Pattern[][] = [];
        for (const r of rows) {
          const k = headKey(r[0]);
          if (k === null) spec.push([...Array(c.arity).fill(WILD), ...r.slice(1)]);
          else if (k === c.key) spec.push([...subPatterns(r[0], c.arity), ...r.slice(1)]);
        }
        const w = witness(spec, [...c.argTypes, ...tys.slice(1)]);
        if (w) return [c.build(w.slice(0, c.arity)), ...w.slice(c.arity)];
      }
      return null;
    }
    // incomplete (or infinite) head set: only wildcard rows can cover the rest
    const rest = rows.filter((r) => headKey(r[0]) === null).map((r) => r.slice(1));
    const w = witness(rest, tys.slice(1));
    if (!w) return null;
    const missingCtor = cs && present.size ? cs.find((c) => !present.has(c.key)) : undefined;
    const head = missingCtor ? missingCtor.build(Array(missingCtor.arity).fill(WILD)) : WILD;
    return [head, ...w];
  };

  const match = (e: A.Match, expected: Type | null): Type => {
    const subjT = expr(e.subject, null);
    const result = expected ?? fresh();
    for (const [p, v] of e.arms) {
      withScope(() => {
        pattern(p, subjT);
        expr(v, result, "match arm");
      });
    }
    // exhaustiveness: collect every missing arm
    const rows = e.arms.map(([p]) => [p]);
    const missing: A.Pattern[] = [];
    for (let i = 0; i < 64; i++) {
      const w = witness(rows, [subjT]);
      if (!w) break;
      missing.push(w[0]);
      rows.push([w[0]]);
    }
    if (missing.length) {
      const shown = missing.map((p) => tyPrinter.pat(p));
      const d = err("T004", `match is not exhaustive; missing: ${shown.join(", ")}`, e);
      d.data = { missing: shown };
      const hole = (): A.Hole => ({ k: "Hole", name: "", line: 0, col: 0 });
      const patched: A.Match = { ...e, arms: [...e.arms, ...missing.map((p) => [p, hole()] as [A.Pattern, A.Expr])] };
      fixes.set(d, replaceNode(prog, e, patched));
    }
    return result;
  };

  // -- statements
  const alwaysReturns = (stmts: A.Stmt[]): boolean =>
    stmts.some((s) => s.k === "Return" || (s.k === "If" && s.orelse !== null && alwaysReturns(s.body) && alwaysReturns(s.orelse)));

  const block = (stmts: A.Stmt[]) => withScope(() => stmts.forEach(stmt));

  const stmt = (s: A.Stmt): void => {
    switch (s.k) {
      case "Comment":
        return;
      case "Break":
        if (ctx.loopDepth === 0) err("T010", "break is only allowed inside a for or while loop", s);
        return;
      case "Let":
        bind(s.name, expr(s.value, null), s.mutable);
        return;
      case "Set": {
        let root: A.Expr = s.target;
        while (root.k === "FieldGet") root = root.obj;
        if (root.k !== "Name" || root.path.length !== 1 || (s.target.k === "FieldGet" && /^\d/.test(s.target.name))) {
          err("T001", "assignment needs a var or a field of a var on its left", s);
          expr(s.value, null);
          return;
        }
        const b = lookup(root.path[0]);
        if (!b) {
          err("T002", `unknown name ${root.path[0]}${scopeHint(ctx.item, root.path[0])}`, root);
          expr(s.value, null);
          return;
        }
        if (!b.mutable) {
          err("T006", features().py
            ? `cannot assign to ${root.path[0]}: it is a loop variable or a pattern name; bind a new name instead`
            : `cannot assign to ${root.path[0]}, which is not a var; declare it with var to mutate it`, s);
          expr(s.value, null);
          return;
        }
        const tt = expr(s.target, null);
        expr(s.value, tt, "set");
        return;
      }
      case "Return":
        if (s.value === null) {
          if (!unify(ctx.ret, UNIT)) err("T001", `return without a value in ${ctx.label}, which returns ${show(ctx.ret)}`, s);
          return;
        }
        expr(s.value, ctx.ret, "return value");
        return;
      case "If":
        expr(s.cond, BOOL, "if condition");
        block(s.body);
        if (s.orelse) block(s.orelse);
        return;
      case "ForIn": {
        const it = prune(expr(s.iterable, null));
        const elem = fresh();
        if (!unify(it, con("List", [elem]))) {
          err("T001", `for ... in needs a List, found ${show(it)}`, s);
        }
        withScope(() => {
          if (s.names) {
            // v0.3: `for (a, b) in xs` needs List[(A, B)] with exactly that many slots
            const slots = s.names.map(() => fresh());
            const r = prune(elem);
            if (!unify(elem, { t: "tuple", items: slots })) {
              err("T001", `for (${s.names.join(", ")}) needs a list of ${s.names.length}-tuples, found ${show(con("List", [r]))}`, s);
            }
            s.names.forEach((n, i) => bind(n, slots[i]));
          } else {
            bind(s.var, elem);
          }
          ctx.loopDepth++;
          s.body.forEach(stmt);
          ctx.loopDepth--;
        });
        return;
      }
      case "ForWhile":
        expr(s.cond, BOOL, "loop condition");
        ctx.loopDepth++;
        block(s.body);
        ctx.loopDepth--;
        return;
      case "ExprStmt":
        expr(s.expr, null);
        return;
    }
  };

  // -- holes
  const printer = new Printer();
  const holeDiags = (c: FnCtx) => {
    for (const { node, type } of c.holes) {
      const r = prune(type);
      const want = r.t === "var" ? null : show(type);
      const cands: string[] = [];
      if (want !== null) {
        for (const f of userFns.values()) {
          if (f.name !== c.fnName && printer.ty(f.ret) === want) {
            cands.push(`${f.name}(${f.params.map(([n, t]) => `${n}: ${printer.ty(t)}`).join(", ")}) -> ${want}`);
          }
        }
      }
      const label = node.name ? "?" + node.name : "?";
      diags.push(diag("H001", `hole ${label} in ${c.label}: needs a value of type ${want ?? "unknown"}`, node.line, node.col,
        { data: { expected: want, candidates: cands } }));
    }
  };

  for (const it of prog.items) {
    if (it.k === "Fn") {
      if (userFns.get(it.name)?.node !== it) continue;
      const scope = new Map(it.tparams.map((p) => [p, { t: "rigid", name: p } as Type]));
      const params = it.params.map(([, t]) => toType(t, scope));
      const ret = toType(it.ret, scope);
      ctx = { label: `${features().py ? "def" : "fn"} ${it.name}`, fnName: it.name, ret, isTest: false, scopes: [new Map()], lambdaDepth: 0, loopDepth: 0, holes: [], item: it, effStack: [] };
      const seen = new Set<string>();
      it.params.forEach(([n], i) => {
        if (seen.has(n)) err("T001", `parameter ${n} is declared twice`, it);
        seen.add(n);
        bind(n, params[i]);
      });
      if (it.requires) expr(it.requires, BOOL, "requires");
      if (it.ensures) {
        withScope(() => {
          bind("result", ret);
          expr(it.ensures!, BOOL, "ensures");
        });
      }
      block(it.body);
      if (!isPrim(ret, "Unit") && !alwaysReturns(it.body)) {
        err("T005", `${features().py ? "def" : "fn"} ${it.name} returns ${show(ret)} but can reach its end without a return`, it);
      }
      holeDiags(ctx);
    } else if (it.k === "Test") {
      ctx = { label: features().py ? `def ${testIdent(it.name)}` : `test ${it.name}`, fnName: null, ret: UNIT, isTest: true, scopes: [new Map()], lambdaDepth: 0, loopDepth: 0, holes: [], item: it, effStack: [] };
      block(it.body);
      holeDiags(ctx);
    }
  }

  return { diagnostics: diags, info, fixes, suggestions };
}
