/**
 * v0.5 M3: Canon to a FastAPI backend. models.py (Pydantic v2), logic.py (one plain function per
 * Canon function, with effects as parameters), api.py (one route per api fn), store.py (SQLite
 * tables), and the fixed runtime files. The output must read as hand-written and pass ruff and
 * mypy --strict; the rules are in docs/v0.5-fullstack.md, "Python target".
 */
import type * as A from "./ast.js";
import { isExtern } from "./ast.js";
import { PY_KEYWORDS, routeParams } from "./api.js";
import { diag, type Diagnostic } from "./diagnostics.js";
import { finishGenerated, type GeneratedFile } from "./generated.js";
import { ruleText } from "./manifest.js";
import { cmpStr } from "./normalize.js";
import { STORE_BUILTINS } from "./prelude.js";
import type { ProjectModule, ProjectResult } from "./project.js";
import { pyFloatRepr } from "./py.js";
import { formatPy } from "./pyfmt.js";
import { PY_RUNTIME } from "./pyruntime.js";
import { prune, resolve, type CtorInfo, type Type, type TypeInfo } from "./types.js";


export interface PyGenOptions {
  /** The project's source surface is Canon-Py (to_string of a Bool then gives True/False). */
  py?: boolean;
}

/** G002: the program uses something the Python target cannot express yet. */
export class TargetError extends Error {
  constructor(readonly diagnostics: { path: string; diagnostic: Diagnostic }[]) {
    super(diagnostics.map((d) => `${d.path}:${d.diagnostic.line}:${d.diagnostic.col}: ${d.diagnostic.code}: ${d.diagnostic.message}`).join("\n"));
  }
}

// ------------------------------------------------------------------------------------- names

/** Builtins generated code calls; a Canon name equal to one is renamed (name_). */
const PY_BUILTINS = new Set([
  "len", "sorted", "sum", "print", "list", "dict", "max", "min", "abs", "range", "zip", "enumerate", "str",
  "float", "int", "repr", "isinstance", "next", "iter", "reversed", "tuple", "bool", "reduce", "math", "time",
  "random", "logic", "router", "all", "any", "filter", "map", "set", "open", "format", "hash", "type", "object",
]);

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const pascal = (s: string) => camel(s).replace(/^[a-z]/, (c) => c.toUpperCase());
/** api.stripe.com is the parameter api_stripe_com. */
const hostParam = (h: string) => h.replace(/[^a-z0-9]+/g, "_").replace(/^([0-9])/, "h_$1");

/** A Python string literal: double quotes unless that needs more escapes (ruff's rule). */
export function pyStr(value: string): string {
  const single = value.includes('"') && !value.includes("'");
  const q = single ? "'" : '"';
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + q;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
    // invisible characters are escaped, as ruff asks (PLE2515): zero-width, BOM, line separators, NEL
    else if (c === 0x85 || (c >= 0x200b && c <= 0x200f) || c === 0x2028 || c === 0x2029 || c === 0xfeff) {
      out += "\\u" + c.toString(16).padStart(4, "0");
    }
    else out += ch;
  }
  return q + out + q;
}

/** The value of a Canon string literal (JavaScript escape rules). */
export function canonStrValue(raw: string): string {
  const body = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = body[++i];
    const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
    if (n in simple) out += simple[n];
    else if (n === "x") {
      out += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (n === "u" && body[i + 1] === "{") {
      const end = body.indexOf("}", i);
      out += String.fromCodePoint(parseInt(body.slice(i + 2, end), 16));
      i = end;
    } else if (n === "u") {
      out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16));
      i += 4;
    } else out += n;
  }
  return out;
}

// ------------------------------------------------------------------------------------- imports

class Imports {
  private from = new Map<string, Set<string>>();
  private plain = new Set<string>();
  add(module: string, name: string) {
    if (!this.from.has(module)) this.from.set(module, new Set());
    this.from.get(module)!.add(name);
  }
  module(name: string) {
    this.plain.add(name);
  }
  entries(): [string, Set<string>][] {
    return [...this.from];
  }
  /** Copy every import into another collector. */
  into(other: Imports) {
    for (const [m, names] of this.from) for (const n of names) other.add(m, n);
    for (const m of this.plain) other.module(m);
  }
  /** `depth`: how deep the generated module sits under canon_generated/ (billing/money.py is 1). */
  render(depth = 0): string[] {
    const third = new Set(["fastapi", "pydantic"]);
    const section = (m: string) => (m.startsWith(".") ? 2 : third.has(m.split(".")[0]) ? 1 : 0);
    const kind = (n: string) => (/^[A-Z0-9_]+$/.test(n) && n.length > 1 ? 0 : /^[A-Z]/.test(n) ? 1 : 2);
    const order = (a: string, b: string) => kind(a) - kind(b) || cmpStr(a.toLowerCase(), b.toLowerCase()) || cmpStr(a, b);
    const groups: string[][] = [[], [], []];
    for (const m of [...this.plain].sort(cmpStr)) groups[section(m)].push(`import ${m}`);
    const froms = [...this.from.keys()].sort((a, b) => {
      // relative: "." sorts before ".models"
      return cmpStr(a.replace(/^\.$/, ".!"), b.replace(/^\.$/, ".!"));
    });
    for (const m of froms) {
      const mod = m.startsWith(".") ? ".".repeat(depth) + m : m;
      const names = [...this.from.get(m)!];
      const plainNames = names.filter((n) => !n.includes(" as ")).sort(order);
      // isort: an aliased import sits on its own line, after the plain ones
      if (plainNames.length) groups[section(m)].push(`from ${mod} import ${plainNames.join(", ")}`);
      for (const n of names.filter((x) => x.includes(" as ")).sort(order)) groups[section(m)].push(`from ${mod} import ${n}`);
    }
    const out: string[] = [];
    for (const g of groups) {
      if (!g.length) continue;
      if (out.length) out.push("");
      out.push(...g);
    }
    return out;
  }
}

// ------------------------------------------------------------------------------------- types

interface Decls {
  records: Map<string, A.RecordType>;
  sums: Map<string, A.SumType>;
  variantOf: Map<string, A.SumType>;
  tables: Map<string, A.Table>;
  fns: Map<string, { fn: A.Fn; module: string }>;
}

function collectDecls(project: ProjectResult): Decls {
  const d: Decls = { records: new Map(), sums: new Map(), variantOf: new Map(), tables: new Map(), fns: new Map() };
  for (const m of project.modules) {
    for (const it of m.analysis.prog?.items ?? []) {
      if (isExtern(it)) continue;
      if (it.k === "RecordType") d.records.set(it.name, it);
      if (it.k === "SumType") {
        d.sums.set(it.name, it);
        for (const [v] of it.variants) d.variantOf.set(v, it);
      }
      if (it.k === "Table") d.tables.set(it.name, it);
      if (it.k === "Fn") d.fns.set(it.name, { fn: it, module: m.name });
    }
  }
  return d;
}

/** A Canon type expression as a Python annotation. In models, Int is SafeInt. */
function pyType(te: A.TypeExpr, im: Imports, model: boolean, quoteLater?: Set<string>): string {
  const sub = (t: A.TypeExpr) => pyType(t, im, model, quoteLater);
  if (te.k === "TTuple") return `tuple[${te.items.map(sub).join(", ")}]`;
  if (te.k === "TFn") {
    im.add("collections.abc", "Callable");
    return `Callable[[${te.params.map(sub).join(", ")}], ${sub(te.ret)}]`;
  }
  const args = te.args;
  switch (te.name) {
    case "Int":
      if (model) {
        im.add(".runtime", "SafeInt");
        return "SafeInt";
      }
      return "int";
    case "Float":
      return "float";
    case "Bool":
      return "bool";
    case "String":
      return "str";
    case "Unit":
      return "None";
    case "Option":
      return `${sub(args[0])} | None`;
    case "List":
      return `list[${sub(args[0])}]`;
    case "Map":
      return `dict[${sub(args[0])}, ${sub(args[1])}]`;
    case "Result":
      im.add(".runtime", "Result");
      return `Result[${sub(args[0])}, ${sub(args[1])}]`;
    case "Error":
      im.add(".runtime", "Error");
      return "Error";
    case "Table":
      im.add(".runtime", "Table");
      return `Table[${sub(args[0])}]`;
  }
  const name = quoteLater?.has(te.name) ? `"${te.name}"` : te.name;
  return args.length ? `${name}[${args.map(sub).join(", ")}]` : name;
}

/** An inferred type as a Python annotation (for locals that need one, like an empty list). */
function pyInferred(t: Type, im: Imports): string {
  t = prune(t);
  switch (t.t) {
    case "con": {
      const te: A.TypeExpr = { k: "TName", name: t.name, args: [], line: 0, col: 0 };
      if (!t.args.length) return pyType(te, im, false);
      const a = t.args.map((x) => pyInferred(x, im));
      if (t.name === "Option") return `${a[0]} | None`;
      if (t.name === "List") return `list[${a[0]}]`;
      if (t.name === "Map") return `dict[${a[0]}, ${a[1]}]`;
      if (t.name === "Result") {
        im.add(".runtime", "Result");
        return `Result[${a.join(", ")}]`;
      }
      return `${t.name}[${a.join(", ")}]`;
    }
    case "tuple":
      return `tuple[${t.items.map((x) => pyInferred(x, im)).join(", ")}]`;
    case "fn":
      im.add("collections.abc", "Callable");
      return `Callable[[${t.params.map((x) => pyInferred(x, im)).join(", ")}], ${pyInferred(t.ret, im)}]`;
    case "rigid":
      return t.name;
    default:
      im.add("typing", "Any");
      return "Any";
  }
}

const isCon = (t: Type | undefined, name: string) => {
  const p = t ? prune(t) : undefined;
  return p?.t === "con" && p.name === name;
};

/** Why a type cannot be represented in Python, or null (Option uses None, so None must be unambiguous). */
function optionProblem(t: Type): string | null {
  t = prune(t);
  if (t.t === "con") {
    if (t.name === "Option") {
      const inner = prune(t.args[0]);
      if (inner.t === "con" && (inner.name === "Option" || inner.name === "Unit")) {
        return "an Option of an Option (or of Unit): the Python target writes Option[T] as T | None, which cannot nest";
      }
    }
    for (const a of t.args) {
      const p = optionProblem(a);
      if (p) return p;
    }
  } else if (t.t === "fn") {
    for (const a of [...t.params, t.ret]) {
      const p = optionProblem(a);
      if (p) return p;
    }
  } else if (t.t === "tuple") {
    for (const a of t.items) {
      const p = optionProblem(a);
      if (p) return p;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------- models.py

function genModels(project: ProjectResult): string {
  const im = new Imports();
  im.add("pydantic", "BaseModel");
  const blocks: string[] = [];
  const typeVars = new Set<string>();
  const defined = new Set<string>();
  const order: (A.RecordType | A.SumType)[] = [];
  for (const m of project.modules) {
    for (const it of m.analysis.prog?.items ?? []) {
      if (!isExtern(it) && (it.k === "RecordType" || it.k === "SumType")) order.push(it);
    }
  }
  const later = new Set(order.map((t) => t.name));
  const generic = (params: string[]) => {
    if (!params.length) return "";
    im.add("typing", "Generic");
    im.add("typing", "TypeVar");
    for (const p of params) typeVars.add(p);
    return `, Generic[${params.join(", ")}]`;
  };
  for (const t of order) {
    later.delete(t.name);
    if (t.k === "RecordType") {
      const fields = t.fields.map(([n, te]) => `    ${n}: ${pyType(te, im, true, later)}`);
      blocks.push([`class ${t.name}(BaseModel${generic(t.params)}):`, ...(fields.length ? fields : ["    pass"])].join("\n"));
    } else {
      for (const [vn, fs] of t.variants) {
        im.add("typing", "Literal");
        const fields = fs.map(([n, te]) => `    ${n}: ${pyType(te, im, true, later)}`);
        blocks.push([`class ${vn}(BaseModel${generic(t.params)}):`, `    kind: Literal["${vn}"] = "${vn}"`, ...fields].join("\n"));
      }
      const tp = t.params.length ? `[${t.params.join(", ")}]` : "";
      const names = t.variants.map(([vn]) => vn + tp);
      if (names.length === 1) blocks.push(`${t.name} = ${names[0]}`);
      else {
        im.add("typing", "Annotated");
        im.add("pydantic", "Field");
        blocks.push(`${t.name} = Annotated[${names.join(" | ")}, Field(discriminator="kind")]`);
      }
    }
    defined.add(t.name);
  }
  const head = im.render();
  const tv = [...typeVars].sort(cmpStr).map((v) => `${v} = TypeVar("${v}")`);
  const body = [...head, ...(tv.length ? ["", ...tv] : []), ...blocks.flatMap((b) => ["", "", ...b.split("\n")])];
  return formatPy(body) + "\n";
}

// ------------------------------------------------------------------------------------- logic

/** How a Canon function's effects become parameters: tables, then hosts. */
interface EffectParams {
  tables: string[];
  /** Hosts from net(<host>), or ["*"] for plain net. */
  hosts: string[];
}

function effectParams(fn: A.Fn): EffectParams {
  const tables = fn.effects.flatMap((e) => (e.startsWith("store(") ? [e.slice(6, -1)] : [])).sort(cmpStr);
  const hosts = fn.effects.includes("net") ? ["*"] : fn.effects.flatMap((e) => (e.startsWith("net(") ? [e.slice(4, -1)] : [])).sort(cmpStr);
  return { tables, hosts };
}

const hostVar = (h: string) => (h === "*" ? "net" : hostParam(h));

interface Ex {
  code: string;
  prec: number;
}

const P = { lambda: 1, ternary: 2, or: 3, and: 4, not: 5, cmp: 6, add: 10, mul: 11, unary: 12, atom: 16 };
const atom = (code: string): Ex => ({ code, prec: P.atom });
const par = (e: Ex, min: number) => (e.prec < min ? `(${e.code})` : e.code);

class Unsupported extends Error {
  constructor(readonly node: A.Pos, message: string) {
    super(message);
  }
}

/** Generates one Python module of logic functions from one Canon module. */
class LogicGen {
  readonly im = new Imports();
  readonly typeVars = new Set<string>();
  private out: string[] = [];
  private indent = "";
  private scopes: Map<string, string>[] = [];
  private used = new Set<string>();
  private fn: A.Fn | null = null;
  private eff: EffectParams = { tables: [], hosts: [] };
  private resultName: string | null = null;
  /** Inside a lambda, a comprehension or a while condition: nothing may be emitted before it (CB-1). */
  private noHoist = 0;

  private hoistable<T>(f: () => T): T {
    this.noHoist++;
    try {
      return f();
    } finally {
      this.noHoist--;
    }
  }

  constructor(
    readonly module: ProjectModule,
    readonly info: TypeInfo,
    readonly d: Decls,
    readonly opts: PyGenOptions,
    /** Python module (relative import path) holding each function, for calls across modules. */
    readonly fnHome: (name: string) => string,
    /** This module's own Python name (logic, or the Canon module's name). */
    readonly logicName = "logic",
  ) {}

  // -- scopes and names
  private lookup(n: string): string | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const v = this.scopes[i].get(n);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  private freshName(base: string): string {
    let name = PY_KEYWORDS.has(base) || PY_BUILTINS.has(base) || this.isGlobal(base) ? `${base}_` : base;
    let k = 2;
    while (this.used.has(name)) name = `${base}_${k++}`;
    this.used.add(name);
    return name;
  }
  private isGlobal(n: string): boolean {
    return this.d.fns.has(n) || this.d.records.has(n) || this.d.variantOf.has(n);
  }
  /** Bind a Canon name in the current scope: renamed when it would overwrite a visible one. */
  private bind(n: string): string {
    const visiblePy = new Set(this.scopes.flatMap((m) => [...m.values()]));
    const reserved = PY_KEYWORDS.has(n) || PY_BUILTINS.has(n) || this.isGlobal(n);
    const py = this.lookup(n) === undefined && !reserved && !visiblePy.has(n) ? n : this.freshName(n);
    this.used.add(py);
    this.scopes[this.scopes.length - 1].set(n, py);
    return py;
  }
  private withScope<T>(f: () => T): T {
    this.scopes.push(new Map());
    try {
      return f();
    } finally {
      this.scopes.pop();
    }
  }
  private emit(line: string) {
    this.out.push(this.indent + line);
  }
  private block(f: () => void) {
    const saved = this.indent;
    this.indent += "    ";
    const before = this.out.length;
    this.withScope(f);
    if (this.out.length === before) this.emit("pass");
    this.indent = saved;
  }
  private typeOf(e: A.Expr): Type | undefined {
    const t = this.info.types.get(e);
    return t ? resolve(t) : undefined;
  }
  private helper(name: string, from = ".runtime"): string {
    this.im.add(from, name);
    return name;
  }

  /** An api fn's requires, as the route checks it: parameters keep their Canon names. */
  validation(fn: A.Fn, e: A.Expr): string {
    this.fn = fn;
    this.scopes = [new Map(fn.params.map(([n]) => [n, n]))];
    this.used = new Set(fn.params.map(([n]) => n));
    return this.ex(e).code;
  }

  // -- functions
  genFn(fn: A.Fn, doc: string[]): string[] {
    this.out = [];
    this.indent = "";
    this.scopes = [new Map()];
    this.used = new Set();
    this.fn = fn;
    this.eff = effectParams(fn);
    for (const tp of fn.tparams) {
      this.typeVars.add(tp);
      this.im.add("typing", "TypeVar");
    }
    const params = fn.params.map(([n, t]) => `${this.bind(n)}: ${pyType(t, this.im, false)}`);
    for (const t of this.eff.tables) {
      const row = this.d.tables.get(t)!.row;
      this.im.add(".runtime", "Table");
      this.im.add(".models", row);
      params.push(`${this.reserve(t)}: Table[${row}]`);
    }
    for (const h of this.eff.hosts) {
      this.im.add(".net", "Http");
      params.push(`${this.reserve(hostVar(h))}: Http`);
    }
    this.useTypes(fn);
    this.emit(`def ${fn.name}(${params.join(", ")}) -> ${pyType(fn.ret, this.im, false)}:`);
    this.block(() => {
      if (doc.length) this.emit(`"""${doc.join(" ").replace(/"""/g, "'''")}"""`);
      if (fn.requires && !fn.route) {
        this.im.add(".runtime", "check");
        this.emit(`check(${this.ex(fn.requires).code}, "R001", ${pyStr(`requires failed in fn ${fn.name}`)})`);
      }
      this.resultName = fn.ensures ? "result" : null;
      for (const s of fn.body) this.stmt(s);
    });
    return this.out;
  }

  private reserve(name: string): string {
    this.used.add(name);
    this.scopes[0].set(`$${name}`, name);
    return name;
  }

  private useTypes(fn: A.Fn) {
    const walk = (te: A.TypeExpr) => {
      if (te.k === "TName") {
        if (this.d.records.has(te.name) || this.d.sums.has(te.name)) this.im.add(".models", te.name);
        te.args.forEach(walk);
      } else if (te.k === "TFn") {
        te.params.forEach(walk);
        walk(te.ret);
      } else te.items.forEach(walk);
    };
    fn.params.forEach(([, t]) => walk(t));
    walk(fn.ret);
  }

  // -- statements
  private stmt(s: A.Stmt): void {
    switch (s.k) {
      case "Comment":
        this.emit(s.text);
        return;
      case "Let":
        this.toTarget(s.value, { k: "let", name: s.name, value: s.value });
        return;
      case "Set": {
        if (s.target.k === "Name") {
          const py = this.lookup(s.target.path[0])!;
          this.toTarget(s.value, { k: "assign", py });
          return;
        }
        // p.a.b = e rebinds p to an updated copy
        const chain: string[] = [];
        let root: A.Expr = s.target;
        while (root.k === "FieldGet") {
          chain.unshift(root.name);
          root = root.obj;
        }
        const py = this.lookup((root as A.Name).path[0])!;
        const value = this.simple(s.value);
        const copy = (obj: string, names: string[]): string =>
          names.length === 1
            ? `${obj}.model_copy(update={${pyStr(names[0])}: ${value}})`
            : `${obj}.model_copy(update={${pyStr(names[0])}: ${copy(`${obj}.${names[0]}`, names.slice(1))}})`;
        this.emit(`${py} = ${copy(py, chain)}`);
        return;
      }
      case "Return":
        if (s.value === null) this.emit("return");
        else this.toTarget(s.value, { k: "return" });
        return;
      case "If": {
        let cur: A.If = s;
        let kw = "if";
        for (;;) {
          const cond = this.simple(cur.cond);
          this.emit(`${kw} ${cond}:`);
          this.block(() => cur.body.forEach((x) => this.stmt(x)));
          const orelse = cur.orelse;
          if (orelse === null) break;
          if (orelse.length === 1 && orelse[0].k === "If" && !this.needsStatements(orelse[0].cond)) {
            cur = orelse[0];
            kw = "elif";
            continue;
          }
          this.emit("else:");
          this.block(() => orelse.forEach((x) => this.stmt(x)));
          break;
        }
        return;
      }
      case "ForIn": {
        const it = this.simple(s.iterable);
        this.withScope(() => {
          const vars = s.names ? s.names.map((n) => this.bind(n)).join(", ") : this.bind(s.var);
          this.emit(`for ${vars} in ${it}:`);
          this.block(() => s.body.forEach((x) => this.stmt(x)));
        });
        return;
      }
      case "ForWhile": {
        if (this.needsStatements(s.cond)) throw new Unsupported(s, "a while condition that needs statements (match or try)");
        this.emit(`while ${this.hoistable(() => this.ex(s.cond)).code}:`);
        this.block(() => s.body.forEach((x) => this.stmt(x)));
        return;
      }
      case "Break":
        this.emit("break");
        return;
      case "ExprStmt": {
        const e = s.expr;
        if (e.k === "Call" && e.callee.k === "Name" && e.callee.path[0] === "assert" && this.info.calls.get(e) === "builtin") {
          this.emit(`assert ${this.simple(e.args[0])}`);
          return;
        }
        this.toTarget(e, { k: "discard" });
        return;
      }
    }
  }

  /** An expression whose statements (hoisted match or try) are emitted first. */
  private simple(e: A.Expr): string {
    return this.ex(e).code;
  }

  private needsStatements(e: A.Expr | null): boolean {
    let found = false;
    const visit = (x: unknown) => {
      if (found || !x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(visit);
      const k = (x as { k?: string }).k;
      if (k === "Match" || k === "Try") {
        found = true;
        return;
      }
      if (k === "Lambda") return;
      for (const v of Object.values(x)) visit(v);
    };
    visit(e);
    return found;
  }

  /** Emit `e` into a target: return it, bind it, assign it, or evaluate it for its effects. */
  private toTarget(
    e: A.Expr,
    target: { k: "return" } | { k: "let"; name: string; value: A.Expr } | { k: "assign"; py: string } | { k: "discard" },
  ): void {
    if (e.k === "Match") {
      let py: string | null = null;
      if (target.k === "let") {
        py = this.bind(target.name);
        target = { k: "assign", py };
      }
      this.matchStmt(e, target);
      return;
    }
    // take(drop(xs, a), b) bound or returned: rows[start : start + b]
    const sliced = target.k === "return" || target.k === "let" ? this.pageIdiom(e) : null;
    if (sliced) {
      if (target.k === "return") this.emit(`return ${sliced}`);
      else if (target.k === "let") this.emit(`${this.bind(target.name)} = ${sliced}`);
      return;
    }
    const code = this.ex(e).code;
    if (target.k === "return") {
      if (this.resultName && this.fn?.ensures) {
        const res = this.resultBind();
        this.emit(`${res} = ${code}`);
        this.im.add(".runtime", "check");
        const cond = this.withScope(() => {
          this.scopes[this.scopes.length - 1].set("result", res);
          return this.ex(this.fn!.ensures!).code;
        });
        this.emit(`check(${cond}, "R002", ${pyStr(`ensures failed in fn ${this.fn!.name}`)})`);
        this.emit(`return ${res}`);
      } else this.emit(`return ${code}`);
    } else if (target.k === "let") {
      const t = this.typeOf(e);
      const py = this.bind(target.name);
      const empty = (e.k === "ListLit" && e.items.length === 0) ||
        (e.k === "Call" && e.callee.k === "Name" && e.callee.path[0] === "map_from" && e.args[0]?.k === "ListLit" && e.args[0].items.length === 0);
      this.emit(empty && t ? `${py}: ${pyInferred(t, this.im)} = ${code}` : `${py} = ${code}`);
    } else if (target.k === "assign") {
      this.emit(`${target.py} = ${code}`);
    } else {
      this.emit(code);
    }
  }

  private resultBind(): string {
    const existing = this.scopes[0].get("$result");
    if (existing) return existing;
    const n = this.freshName("result");
    this.scopes[0].set("$result", n);
    return n;
  }

  /** take(drop(xs, a), b) as a slice, with named steps when the parts are not names. */
  private pageIdiom(e: A.Expr): string | null {
    const call = (x: A.Expr, name: string): A.Call | null =>
      x.k === "Call" && x.callee.k === "Name" && x.callee.path[0] === name && this.info.calls.get(x) === "builtin" ? x : null;
    const take = call(e, "take");
    const drop = take ? call(take.args[0], "drop") : null;
    if (!take || !drop || this.needsStatements(e)) return null;
    if (!this.nonNegative(drop.args[1]) || !this.nonNegative(take.args[1])) return null;
    const xs = drop.args[0];
    let rows = this.ex(xs).code;
    if (!(xs.k === "Name")) {
      const n = this.freshName("rows");
      this.emit(`${n} = ${rows}`);
      rows = n;
    }
    const a = drop.args[1];
    let start = this.ex(a);
    if (!(a.k === "Name" || a.k === "Int")) {
      const n = this.freshName("start");
      this.emit(`${n} = ${start.code}`);
      start = atom(n);
    }
    const count = this.ex(take.args[1]);
    return `${rows}[${start.code} : ${par(start, P.add)} + ${par(count, P.add + 1)}]`;
  }

  /**
   * Whether an Int expression is never negative, from literals, len and count, and from the
   * function's requires (n >= c with c >= 0). Slicing is then the same as Canon's take and drop.
   */
  private nonNegative(e: A.Expr): boolean {
    const bounds = this.lowerBounds();
    const lo = (x: A.Expr): number | null => {
      if (x.k === "Int") return Number(x.value);
      if (x.k === "Name" && x.path.length === 1) return bounds.get(x.path[0]) ?? null;
      if (x.k === "Call" && x.callee.k === "Name" && ["len", "str_len", "count"].includes(x.callee.path[0])) return 0;
      if (x.k === "Binary") {
        const l = lo(x.left);
        const r = lo(x.right);
        if (l === null || r === null) return null;
        if (x.op === "+") return l + r;
        if (x.op === "*" && l >= 0 && r >= 0) return l * r;
        if (x.op === "-" && x.right.k === "Int") return l - Number(x.right.value);
      }
      return null;
    };
    const v = lo(e);
    return v !== null && v >= 0;
  }

  private lowerBounds(): Map<string, number> {
    const out = new Map<string, number>();
    const visit = (e: A.Expr | null) => {
      if (!e || e.k !== "Binary") return;
      if (e.op === "and") {
        visit(e.left);
        visit(e.right);
        return;
      }
      if (e.left.k === "Name" && e.right.k === "Int" && (e.op === ">=" || e.op === ">")) {
        out.set(e.left.path[0], Number(e.right.value) + (e.op === ">" ? 1 : 0));
      }
    };
    visit(this.fn?.requires ?? null);
    return out;
  }

  // -- match
  private matchStmt(m: A.Match, target: { k: "return" } | { k: "assign"; py: string } | { k: "discard" }) {
    const subjT = this.typeOf(m.subject);
    // a match on a Bool is if/else
    if (isCon(subjT, "Bool") && m.arms.every(([p]) => p.k === "PWild" || (p.k === "PLit" && p.lit.k === "Bool"))) {
      const subj = this.ex(m.subject).code;
      const tArm = m.arms.find(([p]) => p.k === "PWild" || (p.k === "PLit" && (p.lit as A.BoolLit).value));
      const fArm = m.arms.find(([p]) => p.k === "PWild" || (p.k === "PLit" && !(p.lit as A.BoolLit).value));
      if (tArm && fArm) {
        this.emit(`if ${subj}:`);
        this.block(() => this.toTarget(tArm[1], target));
        if (target.k === "return") this.withScope(() => this.toTarget(fArm[1], target));
        else {
          this.emit("else:");
          this.block(() => this.toTarget(fArm[1], target));
        }
        return;
      }
    }
    const subj = this.ex(m.subject).code;
    this.emit(`match ${subj}:`);
    const saved = this.indent;
    this.indent += "    ";
    for (const [pat, body] of m.arms) {
      this.withScope(() => {
        const p = this.pattern(pat, subjT);
        this.emit(`case ${p}:`);
        this.block(() => this.toTarget(body, target));
      });
      if (pat.k === "PWild" || pat.k === "PBind") break; // the rest is unreachable
    }
    this.indent = saved;
  }

  private pattern(p: A.Pattern, t: Type | undefined): string {
    const tp = t ? prune(t) : undefined;
    switch (p.k) {
      case "PWild":
        return "_";
      case "PBind":
        return this.bind(p.name);
      case "PLit":
        return this.ex(p.lit).code;
      case "PTuple": {
        const items = tp?.t === "tuple" ? tp.items : [];
        return `(${p.items.map((x, i) => this.pattern(x, items[i])).join(", ")})`;
      }
      case "PCtor": {
        if (p.name === "None") return "None";
        if (p.name === "Some") {
          const inner = tp?.t === "con" ? tp.args[0] : undefined;
          const sub = p.args[0];
          if (sub.k !== "PWild" && sub.k !== "PBind") return this.pattern(sub, inner);
          const cls = this.classPattern(inner);
          if (cls === null) {
            const n = sub.k === "PBind" ? this.bind(sub.name) : this.freshName("value");
            return `${n} if ${n} is not None`;
          }
          return sub.k === "PBind" ? `${cls.includes("|") ? `(${cls})` : cls} as ${this.bind(sub.name)}` : cls;
        }
        if (p.name === "Ok" || p.name === "Err") {
          this.im.add(".runtime", p.name);
          const args = tp?.t === "con" ? tp.args : [];
          const sub = p.args[0];
          const inner = sub.k === "PWild" ? "" : this.pattern(sub, p.name === "Ok" ? args[0] : args[1]);
          return `${p.name}(${inner})`;
        }
        const sum = this.d.variantOf.get(p.name);
        this.im.add(".models", p.name);
        const fields = sum?.variants.find(([v]) => v === p.name)?.[1] ?? [];
        const ctor = this.info.ctors.get(p.name);
        const kws = p.args.flatMap((a, i) => (a.k === "PWild" ? [] : [`${fields[i][0]}=${this.pattern(a, this.fieldType(ctor, tp, i))}`]));
        return `${p.name}(${kws.join(", ")})`;
      }
    }
  }

  private fieldType(ctor: CtorInfo | undefined, tp: Type | undefined, i: number): Type | undefined {
    if (!ctor) return undefined;
    const te = ctor.fields[i]?.[1];
    if (!te) return undefined;
    const params = ctor.type.params;
    const args = tp?.t === "con" ? tp.args : [];
    const conv = (x: A.TypeExpr): Type => {
      if (x.k === "TName") {
        const j = params.indexOf(x.name);
        if (j >= 0 && args[j]) return args[j];
        return { t: "con", name: x.name, args: x.args.map(conv) };
      }
      if (x.k === "TTuple") return { t: "tuple", items: x.items.map(conv) };
      return { t: "fn", params: x.params.map(conv), ret: conv(x.ret) };
    };
    return conv(te);
  }

  /** The class pattern that matches a value of type t (never None), or null when unknown. */
  private classPattern(t: Type | undefined): string | null {
    const p = t ? prune(t) : undefined;
    if (!p) return null;
    if (p.t === "tuple") return "tuple()";
    if (p.t !== "con") return null;
    const prim: Record<string, string> = { Int: "int()", Float: "float()", String: "str()", Bool: "bool()", List: "list()", Map: "dict()" };
    if (prim[p.name]) return prim[p.name];
    if (p.name === "Result") {
      this.im.add(".runtime", "Ok");
      this.im.add(".runtime", "Err");
      return "Ok() | Err()";
    }
    if (p.name === "Error") {
      this.im.add(".runtime", "Error");
      return "Error()";
    }
    if (this.d.records.has(p.name)) {
      this.im.add(".models", p.name);
      return `${p.name}()`;
    }
    const sum = this.d.sums.get(p.name);
    if (sum) {
      for (const [v] of sum.variants) this.im.add(".models", v);
      return sum.variants.map(([v]) => `${v}()`).join(" | ");
    }
    return null;
  }

  // -- expressions
  private ex(e: A.Expr): Ex {
    const problem = this.typeOf(e) ? optionProblem(this.typeOf(e)!) : null;
    if (problem) throw new Unsupported(e, problem);
    switch (e.k) {
      case "Int":
        return atom(e.value);
      case "Float":
        return atom(pyFloatRepr(e.value));
      case "Str":
        return atom(pyStr(canonStrValue(e.raw)));
      case "Bool":
        return atom(e.value ? "True" : "False");
      case "Name":
        return atom(this.name(e));
      case "Ctor":
        return this.ctor(e.name, []);
      case "Call":
        return this.call(e);
      case "FieldGet": {
        const obj = this.ex(e.obj);
        if (/^\d+$/.test(e.name)) return atom(`${par(obj, P.atom)}[${e.name}]`);
        return atom(`${par(obj, P.atom)}.${e.name}`);
      }
      case "Binary":
        return this.binary(e);
      case "Unary": {
        if (e.op === "not") {
          // not (a == b) is a != b; not contains(xs, x) is x not in xs (the same meaning, NaN included)
          const o = e.operand;
          if (o.k === "Binary" && (o.op === "==" || o.op === "!=")) {
            return this.binary({ ...o, op: o.op === "==" ? "!=" : "==" });
          }
          if (o.k === "Call" && o.callee.k === "Name" && o.callee.path[0] === "contains" && this.info.calls.get(o) === "builtin") {
            return { code: `${par(this.ex(o.args[1]), P.cmp + 1)} not in ${par(this.ex(o.args[0]), P.cmp + 1)}`, prec: P.cmp };
          }
          return { code: `not ${par(this.ex(o), P.not)}`, prec: P.not };
        }
        // -(-x) is x (for Int and Float alike, -0.0 included); Python would read --x as a typo (B002)
        if (e.operand.k === "Unary" && e.operand.op === "-") return this.ex(e.operand.operand);
        return { code: `-${par(this.ex(e.operand), P.unary)}`, prec: P.unary };
      }
      case "Lambda":
        return this.lambda(e);
      case "ListLit":
        return atom(`[${e.items.map((x) => this.ex(x).code).join(", ")}]`);
      case "TupleLit":
        return atom(`(${e.items.map((x) => this.ex(x).code).join(", ")})`);
      case "Record": {
        if (this.d.records.has(e.tname)) this.im.add(".models", e.tname);
        if (e.tname === "Error") this.im.add(".runtime", "Error");
        return atom(`${e.tname}(${e.fields.map(([n, v]) => `${n}=${this.ex(v).code}`).join(", ")})`);
      }
      case "Match": {
        if (this.noHoist) throw new Unsupported(e, "a match inside a lambda or a while condition; bind it with let first, or use a helper function");
        const tmp = this.freshName("value");
        this.matchStmt(e, { k: "assign", py: tmp });
        return atom(tmp);
      }
      case "Try": {
        if (this.noHoist) throw new Unsupported(e, "try inside a lambda or a while condition");
        // result = f(); if isinstance(result, Err): return result
        const base = this.freshName("result");
        this.emit(`${base} = ${this.ex(e.expr).code}`);
        this.im.add(".runtime", "Err");
        this.emit(`if isinstance(${base}, Err):`);
        this.emit(`    return ${base}`);
        return atom(`${base}.value`);
      }
      case "Hole":
        throw new Unsupported(e, "a hole");
    }
  }

  private name(e: A.Name): string {
    const n = e.path[0];
    const local = this.lookup(n);
    if (local !== undefined) return local;
    const kind = this.info.names.get(e);
    if (kind === "table") return this.scopes[0].get(`$${n}`) ?? n;
    if (kind === "builtin") return this.builtinValue(n, e);
    // a user function as a value: hand it its tables and hosts
    const target = this.d.fns.get(n);
    if (target) {
      this.importFn(n);
      const ep = effectParams(target.fn);
      if (ep.tables.length || ep.hosts.length) {
        const ps = target.fn.params.map(([p]) => p);
        return `lambda ${ps.join(", ")}: ${n}(${[...ps, ...this.effectArgs(ep)].join(", ")})`;
      }
    }
    return n;
  }

  private importFn(n: string) {
    const home = this.fnHome(n);
    if (home !== this.logicName) this.im.add(pyModulePath(home), n);
  }

  private builtinValue(n: string, at: A.Pos): string {
    const direct: Record<string, string> = {
      str_len: "len", len: "len", abs: "abs", to_float: "float", print: "print", reverse: "list", min: "min", max: "max",
      sum: "sum",
    };
    if (direct[n]) return direct[n];
    if (["trim", "is_email", "parse_int", "parse_float", "to_int", "sum_float"].includes(n)) return this.helper(n);
    throw new Unsupported(at, `the built-in ${n} used as a value`);
  }

  private effectArgs(ep: EffectParams): string[] {
    const args = ep.tables.map((t) => this.scopes[0].get(`$${t}`) ?? t);
    for (const h of ep.hosts) {
      if (this.eff.hosts.includes("*")) args.push("net");
      else args.push(hostVar(h));
    }
    return args;
  }

  private ctor(name: string, args: A.Expr[]): Ex {
    if (name === "None") return atom("None");
    if (name === "Some") return this.ex(args[0]);
    if (name === "Ok" || name === "Err") {
      this.im.add(".runtime", name);
      return atom(`${name}(${args.map((a) => this.ex(a).code).join(", ")})`);
    }
    this.im.add(".models", name);
    const sum = this.d.variantOf.get(name);
    const fields = sum?.variants.find(([v]) => v === name)?.[1] ?? [];
    return atom(`${name}(${args.map((a, i) => `${fields[i][0]}=${this.ex(a).code}`).join(", ")})`);
  }

  private binary(e: A.Binary): Ex {
    const lt = this.typeOf(e.left);
    const op = e.op;
    if (op === "and" || op === "or") {
      const p = op === "and" ? P.and : P.or;
      if (this.needsStatements(e.right)) throw new Unsupported(e, `match or try on the right of ${op === "and" ? "&&" : "||"}`);
      return { code: `${par(this.ex(e.left), p)} ${op} ${par(this.ex(e.right), p + 1)}`, prec: p };
    }
    if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      return { code: `${par(this.ex(e.left), P.cmp + 1)} ${op} ${par(this.ex(e.right), P.cmp + 1)}`, prec: P.cmp };
    }
    const isInt = isCon(lt, "Int");
    if (op === "/" && isInt) return atom(`${this.helper("div")}(${this.ex(e.left).code}, ${this.ex(e.right).code})`);
    if (op === "%" && isInt) return atom(`${this.helper("rem")}(${this.ex(e.left).code}, ${this.ex(e.right).code})`);
    if (op === "%") {
      this.im.module("math");
      return atom(`math.fmod(${this.ex(e.left).code}, ${this.ex(e.right).code})`);
    }
    // a string built with + and to_string reads better as an f-string
    if (op === "+" && isCon(lt, "String")) {
      const f = this.fString(e);
      if (f) return atom(f);
    }
    const p = op === "+" || op === "-" ? P.add : P.mul;
    return { code: `${par(this.ex(e.left), p)} ${op} ${par(this.ex(e.right), p + 1)}`, prec: p };
  }

  private fString(e: A.Binary): string | null {
    const parts: A.Expr[] = [];
    const flatten = (x: A.Expr) => {
      if (x.k === "Binary" && x.op === "+" && isCon(this.typeOf(x), "String")) {
        flatten(x.left);
        flatten(x.right);
      } else parts.push(x);
    };
    flatten(e);
    if (!parts.some((x) => x.k === "Str") || parts.every((x) => x.k === "Str")) return null;
    let out = "";
    for (const x of parts) {
      if (x.k === "Str") {
        out += pyStr(canonStrValue(x.raw)).slice(1, -1).replace(/\{/g, "{{").replace(/\}/g, "}}");
        continue;
      }
      let inner: A.Expr = x;
      if (x.k === "Call" && x.callee.k === "Name" && x.callee.path[0] === "to_string" && this.info.calls.get(x) === "builtin") {
        const t = this.typeOf(x.args[0]);
        if (!(isCon(t, "Int") || isCon(t, "String"))) return null;
        inner = x.args[0];
      }
      const code = this.ex(inner).code;
      if (/["'{}\\]/.test(code)) return null;
      out += `{${code}}`;
    }
    if (out.includes('"') || out.includes("'")) return null;
    return `f"${out}"`;
  }

  private lambda(e: A.Lambda): Ex {
    return this.withScope(() => {
      if (this.info.unpack.has(e)) {
        const p = this.freshName("pair");
        e.params.forEach((n, i) => this.scopes[this.scopes.length - 1].set(n, `${p}[${i}]`));
        return { code: `lambda ${p}: ${this.hoistable(() => this.ex(e.body)).code}`, prec: P.lambda };
      }
      const ps = e.params.map((n) => this.bind(n));
      return { code: `lambda ${ps.join(", ")}: ${this.hoistable(() => this.ex(e.body)).code}`, prec: P.lambda };
    });
  }

  /** A comprehension over xs whose element is the lambda's parameter(s). */
  private comprehension(xs: A.Expr, f: A.Expr, kind: "map" | "filter"): Ex | null {
    if (f.k !== "Lambda") return null;
    // iterate enumerate(...) and zip(...) directly, without list(...)
    const lazy = xs.k === "Call" && xs.callee.k === "Name" && ["enumerate", "zip"].includes(xs.callee.path[0]) && this.info.calls.get(xs) === "builtin";
    const src = lazy ? (() => {
      const call = xs as A.Call;
      return `${(call.callee as A.Name).path[0]}(${call.args.map((x) => this.ex(x).code).join(", ")})`;
    })() : this.ex(xs).code;
    return this.withScope(() => {
      const vars = f.params.map((n) => this.bind(n));
      const target = vars.join(", ");
      const body = this.hoistable(() => this.ex(f.body));
      if (kind === "map") return atom(`[${par(body, P.ternary)} for ${target} in ${src}]`);
      const elem = vars.length === 1 ? vars[0] : `(${target})`;
      return atom(`[${elem} for ${target} in ${src} if ${par(body, P.or)}]`);
    });
  }

  private call(e: A.Call): Ex {
    if (e.callee.k === "Ctor") return this.ctor(e.callee.name, e.args);
    const name = e.callee.path[0];
    const kind = this.info.calls.get(e);
    if (kind === "local") {
      return atom(`${this.lookup(name)}(${e.args.map((a) => this.ex(a).code).join(", ")})`);
    }
    if (kind === "user") {
      this.importFn(name);
      const target = this.d.fns.get(name)!;
      const args = [...e.args.map((a) => this.ex(a).code), ...this.effectArgs(effectParams(target.fn))];
      return atom(`${name}(${args.join(", ")})`);
    }
    return this.builtin(name, e);
  }

  private builtin(n: string, e: A.Call): Ex {
    const a = e.args;
    const x = (i: number) => this.ex(a[i]);
    const c = (i: number) => x(i).code;
    if (STORE_BUILTINS.has(n) && a[0]?.k === "Name" && this.info.names.get(a[0]) === "table") {
      const t = this.scopes[0].get(`$${a[0].path[0]}`) ?? a[0].path[0];
      return atom(`${t}.${n}(${a.slice(1).map((_, i) => c(i + 1)).join(", ")})`);
    }
    const t0 = a[0] ? this.typeOf(a[0]) : undefined;
    switch (n) {
      case "len":
      case "str_len":
        return atom(`len(${c(0)})`);
      case "map":
        return this.comprehension(a[0], a[1], "map") ?? atom(`[${c(1)}(item) for item in ${c(0)}]`);
      case "filter":
        return this.comprehension(a[0], a[1], "filter") ?? atom(`[item for item in ${c(0)} if ${c(1)}(item)]`);
      case "fold":
        this.im.add("functools", "reduce");
        return atom(`reduce(${c(2)}, ${c(0)}, ${c(1)})`);
      case "sum":
        return atom(`sum(${c(0)})`);
      case "sum_float":
        return atom(`${this.helper("sum_float")}(${c(0)})`);
      case "sort_by":
        return atom(`sorted(${c(0)}, key=${c(1)})`);
      case "sort_desc_by":
        return atom(`sorted(${c(0)}, key=${c(1)}, reverse=True)`);
      case "group_by":
        return atom(`${this.helper("group_by")}(${c(0)}, ${c(1)})`);
      case "take": {
        const n = x(1);
        return atom(`${par(x(0), P.atom)}[:${this.nonNegative(a[1]) ? n.code : ` max(${n.code}, 0)`}]`);
      }
      case "drop": {
        const n = x(1);
        const simpleN = a[1].k === "Name" || a[1].k === "Int";
        return atom(`${par(x(0), P.atom)}[${this.nonNegative(a[1]) ? (simpleN ? n.code : `${n.code} `) : `max(${n.code}, 0) `}:]`);
      }
      case "first":
        return a[0].k === "Name" ? { code: `${c(0)}[0] if ${c(0)} else None`, prec: P.ternary } : atom(`next(iter(${c(0)}), None)`);
      case "last":
        return a[0].k === "Name" ? { code: `${c(0)}[-1] if ${c(0)} else None`, prec: P.ternary } : atom(`next(reversed(${c(0)}), None)`);
      case "append":
        return atom(`[*${c(0)}, ${c(1)}]`);
      case "contains":
        return { code: `${par(x(1), P.cmp + 1)} in ${par(x(0), P.cmp + 1)}`, prec: P.cmp };
      case "reverse":
        return atom(`${par(x(0), P.atom)}[::-1]`);
      case "zip":
        return atom(`list(zip(${c(0)}, ${c(1)}))`);
      case "enumerate":
        return atom(`list(enumerate(${c(0)}))`);
      case "range":
        return atom(`list(range(${c(0)}, ${c(1)}))`);
      case "min":
      case "max":
      case "abs":
        return atom(`${n}(${a.map((_, i) => c(i)).join(", ")})`);
      case "pow":
        return atom(`${this.helper("power")}(${c(0)}, ${c(1)})`);
      case "to_string": {
        if (isCon(t0, "Int")) return atom(`str(${c(0)})`);
        if (isCon(t0, "Float")) return atom(`repr(${c(0)})`);
        if (isCon(t0, "String")) return x(0);
        if (isCon(t0, "Bool")) {
          if (this.opts.py) return atom(`str(${c(0)})`);
          return { code: `"true" if ${par(x(0), P.ternary + 1)} else "false"`, prec: P.ternary };
        }
        throw new Unsupported(e, "to_string of a value that is not an Int, Float, String or Bool");
      }
      case "to_float":
        return atom(`float(${c(0)})`);
      case "to_int":
      case "parse_int":
      case "parse_float":
      case "trim":
      case "is_email":
        return atom(`${this.helper(n)}(${c(0)})`);
      case "split":
        if (a[1].k === "Str" && canonStrValue(a[1].raw) !== "") return atom(`${par(x(0), P.atom)}.split(${c(1)})`);
        return atom(`${this.helper("split")}(${c(0)}, ${c(1)})`);
      case "join":
        return atom(`${par(x(1), P.atom)}.join(${c(0)})`);
      case "unwrap_or": {
        const o = x(0);
        const fallback = x(1);
        const pure = (y: A.Expr) => y.k === "Name" || y.k === "Int" || y.k === "Str" || y.k === "Bool" || y.k === "Float" || y.k === "FieldGet";
        if (pure(a[0]) && pure(a[1])) return { code: `${par(o, P.or)} if ${par(o, P.cmp + 1)} is not None else ${par(fallback, P.ternary)}`, prec: P.ternary };
        // anything else evaluates both arguments once, eagerly, as Canon does (CB-1: never hoist a
        // temporary, which breaks inside a lambda or a loop condition)
        return atom(`${this.helper("unwrap_or")}(${o.code}, ${fallback.code})`);
      }
      case "is_some":
        return { code: `${par(x(0), P.cmp + 1)} is not None`, prec: P.cmp };
      case "map_from": {
        // map_from(map(xs, |x| (k, v))) is a dict comprehension
        const inner = a[0];
        if (inner.k === "Call" && inner.callee.k === "Name" && inner.callee.path[0] === "map" && this.info.calls.get(inner) === "builtin" &&
            inner.args[1].k === "Lambda" && inner.args[1].body.k === "TupleLit" && inner.args[1].body.items.length === 2 && !this.info.unpack.has(inner.args[1])) {
          const f = inner.args[1];
          const src = this.ex(inner.args[0]).code;
          return this.withScope(() => {
            const vars = f.params.map((n) => this.bind(n)).join(", ");
            const [k, v] = this.hoistable(() => (f.body as A.TupleLit).items.map((x) => this.ex(x).code));
            return atom(`{${k}: ${v} for ${vars} in ${src}}`);
          });
        }
        return atom(`dict(${c(0)})`);
      }
      case "map_get":
        return atom(`${par(x(0), P.atom)}.get(${c(1)})`);
      case "map_set":
        return atom(`{**${c(0)}, ${c(1)}: ${c(2)}}`);
      case "keys":
        return atom(`list(${c(0)})`);
      case "values":
        return atom(`list(${par(x(0), P.atom)}.values())`);
      case "assert":
        throw new Unsupported(e, "assert inside an expression");
      case "print":
        return atom(`print(${c(0)})`);
      case "now":
        return atom(`${this.helper("now")}()`);
      case "sleep":
        this.im.module("time");
        return atom(`time.sleep(${c(0)} / 1000)`);
      case "random":
        this.im.module("random");
        return atom("random.random()");
      case "random_int":
        this.im.module("random");
        return atom(`random.randrange(${c(0)}, ${c(1)})`);
      case "uuid":
        return atom(`${this.helper("uuid", ".accounts")}()`);
      case "hash_password":
        return atom(`${this.helper("hash_password", ".accounts")}(${c(0)})`);
      case "verify_password":
        return atom(`${this.helper("verify_password", ".accounts")}(${c(0)}, ${c(1)})`);
      case "http_get":
      case "http_post": {
        const method = n === "http_get" ? "get" : "post";
        const hosts = this.eff.hosts;
        let client: string;
        if (hosts.includes("*")) client = "net";
        else {
          const lit = a[0].k === "Str" ? /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:?#]+)/.exec(canonStrValue(a[0].raw))?.[1]?.toLowerCase() : undefined;
          if (lit && hosts.includes(lit)) client = hostVar(lit);
          else if (hosts.length === 1) client = hostVar(hosts[0]);
          else throw new Unsupported(e, "a computed URL in a function that declares several hosts; split it, one host per function");
        }
        return atom(`${client}.${method}(${a.map((_, i) => c(i)).join(", ")})`);
      }
      default:
        throw new Unsupported(e, `the built-in ${n}`);
    }
  }
}

/** The relative import path from one generated Python module to another. */
function pyModulePath(target: string): string {
  return "." + target;
}

// ------------------------------------------------------------------------------------- generate

export function generateFastapi(project: ProjectResult, opts: PyGenOptions = {}): GeneratedFile[] {
  const d = collectDecls(project);
  const single = project.modules.length === 1;
  const logicModule = (canonModule: string) => (single ? "logic" : canonModule);
  const fnHome = (n: string) => logicModule(d.fns.get(n)!.module);
  const files: GeneratedFile[] = [];
  const problems: { path: string; diagnostic: Diagnostic }[] = [];
  const from = single ? project.modules[0].path : sourceFolder(project);
  const usesNet = [...d.fns.values()].some(({ fn }) => effectParams(fn).hosts.length > 0);
  let usesAccounts = false;

  // models.py
  files.push({ path: "models.py", text: finishGenerated(genModels(project), "#", from) });

  // logic: one Python module per Canon module (logic.py for a one-module project)
  for (const m of project.modules) {
    if (!m.analysis.prog || !m.analysis.info) continue;
    const gen = new LogicGen(m, m.analysis.info, d, opts, fnHome, logicModule(m.name));
    const depth = single ? 0 : m.name.split(".").length - 1;
    const fnBlocks: string[][] = [];
    let doc: string[] = [];
    for (const it of m.analysis.prog.items) {
      if (isExtern(it)) continue;
      if (it.k === "Comment") {
        doc.push(it.text.replace(/^#\s?/, ""));
        continue;
      }
      if (it.k === "Fn") {
        try {
          fnBlocks.push(gen.genFn(it, doc));
        } catch (e) {
          if (!(e instanceof Unsupported)) throw e;
          problems.push({ path: m.path, diagnostic: diag("G002", `the Python target cannot express ${e.message} (fn ${it.name})`, e.node.line || it.line, e.node.col || it.col) });
        }
      }
      doc = [];
    }
    const typeVars = [...gen.typeVars].sort(cmpStr).map((v) => `${v} = TypeVar("${v}")`);
    const text = [
      ...gen.im.render(depth),
      ...(typeVars.length ? ["", ...typeVars] : []),
      ...fnBlocks.flatMap((b) => ["", "", ...b]),
    ];
    if (gen.im.render().some((l) => l.includes(".accounts"))) usesAccounts = true;
    const path = (single ? "logic" : logicModule(m.name).replace(/\./g, "/")) + ".py";
    files.push({ path, text: finishGenerated(formatPy(text) + "\n", "#", m.path) });
    if (!single) {
      // packages for nested modules (billing/money.py needs billing/__init__.py)
      const parts = m.name.split(".").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join("/") + "/__init__.py";
        if (!files.some((f) => f.path === p)) files.push({ path: p, text: finishGenerated("", "#", null) });
      }
    }
  }
  if (problems.length) throw new TargetError(problems);

  // api.py
  files.push({ path: "api.py", text: finishGenerated(genApi(project, d, single, opts, fnHome), "#", from) });

  // runtime files
  files.push({ path: "runtime.py", text: finishGenerated(PY_RUNTIME["runtime.py"], "#", null) });
  if (d.tables.size) {
    const keys = [...d.tables.values()].map((t) => `${pyStr(t.name)}: ${pyStr(t.key)}`).join(", ");
    const store = PY_RUNTIME["store.py"].replace("KEYS: dict[str, str] = {}", formatPy([`KEYS: dict[str, str] = {${keys}}`]));
    files.push({ path: "store.py", text: finishGenerated(store, "#", null) });
  }
  if (usesNet) files.push({ path: "net.py", text: finishGenerated(PY_RUNTIME["net.py"], "#", null) });
  if (usesAccounts) files.push({ path: "accounts.py", text: finishGenerated(PY_RUNTIME["accounts.py"], "#", null) });
  files.push({ path: "__init__.py", text: finishGenerated("", "#", null) });
  files.push({ path: "../main.py", text: MAIN_PY, userOwned: true });
  return files;
}

function sourceFolder(project: ProjectResult): string {
  const dirs = project.modules.map((m) => m.path.split("/").slice(0, -(m.name.split(".").length)).join("/"));
  return (dirs[0] || ".") + "/";
}

export const MAIN_PY = `"""The FastAPI app. canon build writes this file once and never changes it again: it is yours."""

from fastapi import FastAPI

from canon_generated.api import router
from canon_generated.runtime import install

app = FastAPI()
install(app)
app.include_router(router)
`;

// ------------------------------------------------------------------------------------- api.py

function genApi(project: ProjectResult, d: Decls, single: boolean, opts: PyGenOptions, fnHome: (n: string) => string): string {
  const im = new Imports();
  im.add("fastapi", "APIRouter");
  const deps: string[] = [];
  const depNames = new Map<string, string>();
  const typeNames = new Set([...d.records.keys(), ...d.sums.keys(), ...d.variantOf.keys()]);
  const tableAlias = (t: string) => {
    if (!depNames.has(`t:${t}`)) {
      let alias = pascal(t);
      if (typeNames.has(alias)) alias += "Table";
      const row = d.tables.get(t)!.row;
      im.add("typing", "Annotated");
      im.add("fastapi", "Depends");
      im.add(".runtime", "Table");
      im.add(".runtime", "table");
      im.add(".models", row);
      deps.push(`${alias} = Annotated[Table[${row}], Depends(table(${pyStr(t)}, ${row}))]`);
      depNames.set(`t:${t}`, alias);
    }
    return depNames.get(`t:${t}`)!;
  };
  const hostAlias = (h: string) => {
    if (!depNames.has(`h:${h}`)) {
      const alias = h === "*" ? "AnyHost" : pascal(hostParam(h));
      im.add("typing", "Annotated");
      im.add("fastapi", "Depends");
      im.add(".net", "Http");
      im.add(".net", "http");
      deps.push(`${alias} = Annotated[Http, Depends(http(${h === "*" ? "None" : pyStr(h)}))]`);
      depNames.set(`h:${h}`, alias);
    }
    return depNames.get(`h:${h}`)!;
  };
  const routes: string[][] = [];
  // modules imported under an alias, decided before the routes are written
  const moduleAliases = new Set<string>();
  for (const m of project.modules) {
    for (const it of m.analysis.prog?.items ?? []) {
      if (it.k !== "Fn" || !it.route || isExtern(it)) continue;
      const last = single ? "logic" : fnHome(it.name).split(".").pop()!;
      const ep = effectParams(it);
      if (it.params.some(([n]) => n === last) || ep.tables.includes(last) || ep.hosts.map(hostVar).includes(last)) moduleAliases.add(fnHome(it.name));
    }
  }
  for (const m of project.modules) {
    if (!m.analysis.prog || !m.analysis.info) continue;
    for (const it of m.analysis.prog.items) {
      if (it.k !== "Fn" || !it.route || isExtern(it)) continue;
      const home = fnHome(it.name);
      const ep = effectParams(it);
      const last = single ? "logic" : home.split(".").pop()!;
      // a module whose name a route parameter would hide (a users module with a users table) gets an alias
      const clash = it.params.some(([n]) => n === last) || ep.tables.includes(last) || ep.hosts.map(hostVar).includes(last);
      const mod = clash || moduleAliases.has(home) ? `${last}_logic` : last;
      if (mod !== last) moduleAliases.add(home);
      const parent = "." + (single ? "" : home.split(".").slice(0, -1).join("."));
      im.add(parent, mod === last ? last : `${last} as ${mod}`);
      const pathParams = routeParams(it.route.path) as string[];
      const required: string[] = [];
      const optional: string[] = [];
      const typesIm = new Imports();
      for (const [n, t] of it.params) {
        const pt = pyType(t, typesIm, false);
        for (const nm of mentionedTypes(t)) if (d.records.has(nm) || d.sums.has(nm)) im.add(".models", nm);
        const isOpt = t.k === "TName" && t.name === "Option" && !pathParams.includes(n);
        (isOpt ? optional : required).push(isOpt ? `${n}: ${pt} = None` : `${n}: ${pt}`);
      }
      const depParams = [...ep.tables.map((t) => `${t}: ${tableAlias(t)}`), ...ep.hosts.map((h) => `${hostVar(h)}: ${hostAlias(h)}`)];
      const isResult = it.ret.k === "TName" && it.ret.name === "Result";
      const out = isResult ? (it.ret as A.TypeExpr & { k: "TName" }).args[0] : it.ret;
      for (const nm of mentionedTypes(out)) if (d.records.has(nm) || d.sums.has(nm)) im.add(".models", nm);
      const lines = [`@router.${it.route.method.toLowerCase()}(${pyStr(it.route.path)})`,
        `def ${it.name}(${[...required, ...depParams, ...optional].join(", ")}) -> ${pyType(out, typesIm, false)}:`];
      if (it.requires) {
        const g = new LogicGen(m, m.analysis.info, d, opts, fnHome);
        const cond = g.validation(it, it.requires);
        g.im.into(im);
        im.add(".runtime", "require");
        lines.push(`    require(${cond}, ${pyStr(ruleText(it.requires))})`);
      }
      const call = `${mod}.${it.name}(${[...it.params.map(([n]) => n), ...ep.tables, ...ep.hosts.map(hostVar)].join(", ")})`;
      if (isResult) {
        im.add(".runtime", "respond");
        lines.push(`    return respond(${call})`);
      } else lines.push(`    return ${call}`);
      typesIm.into(im);
      routes.push(lines);
    }
  }
  const text = [...im.render(), "", "router = APIRouter()", ...(deps.length ? ["", ...deps] : []), ...routes.flatMap((r) => ["", "", ...r])];
  return formatPy(text) + "\n";
}

function mentionedTypes(te: A.TypeExpr): string[] {
  if (te.k === "TName") return [te.name, ...te.args.flatMap(mentionedTypes)];
  if (te.k === "TTuple") return te.items.flatMap(mentionedTypes);
  return [...te.params.flatMap(mentionedTypes), ...mentionedTypes(te.ret)];
}
