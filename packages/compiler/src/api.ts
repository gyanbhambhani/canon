/**
 * v0.5: checks for `api fn`. A001: the shape of inputs and outputs (route parameters, query
 * parameters, the JSON body, wire types). A002: two endpoints with the same method and path.
 * A003: an api fn's requires must be portable, because it runs in Python on the server and in
 * TypeScript in the client.
 */
import type * as A from "./ast.js";
import { isExtern, walkExprs } from "./ast.js";
import { diag, type Diagnostic } from "./diagnostics.js";
import { Printer } from "./printer.js";

/** Built-ins an api fn's requires may call; each has Python and TypeScript implementations. */
export const PORTABLE_CALLS = new Set(["str_len", "trim", "contains", "len", "is_email", "is_some"]);

/** Python keywords: a field or parameter with one of these names cannot be generated. */
export const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
  "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda",
  "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);

const SCALARS = new Set(["Int", "Float", "Bool", "String"]);
const SEGMENT = /^[A-Za-z0-9._~-]*$/;
const PARAM_SEGMENT = /^\{([a-z_][a-z0-9_]*)\}$/;

interface Decls {
  records: Map<string, A.RecordType>;
  sums: Map<string, A.SumType>;
}

function decls(prog: A.Program): Decls {
  const records = new Map<string, A.RecordType>();
  const sums = new Map<string, A.SumType>();
  for (const it of prog.items) {
    if (it.k === "RecordType") records.set(it.name, it);
    if (it.k === "SumType") sums.set(it.name, it);
  }
  // the built-in Error record is a wire type
  if (!records.has("Error")) {
    records.set("Error", { k: "RecordType", name: "Error", params: [], fields: [["message", { k: "TName", name: "String", args: [], line: 0, col: 0 }]], line: 0, col: 0 });
  }
  return { records, sums };
}

const tyText = (t: A.TypeExpr) => new Printer().ty(t);

/** Why a type cannot cross the wire, or null. */
export function wireProblem(t: A.TypeExpr, d: Decls, seen = new Set<string>()): string | null {
  if (t.k === "TFn") return `${tyText(t)} is a function type, which cannot be sent as JSON`;
  if (t.k === "TTuple") {
    for (const x of t.items) {
      const p = wireProblem(x, d, seen);
      if (p) return p;
    }
    return null;
  }
  const { name, args } = t;
  if (SCALARS.has(name) || name === "Unit") return null;
  if (name === "Option") {
    const inner = args[0];
    if (inner?.k === "TName" && (inner.name === "Option" || inner.name === "Unit")) {
      return `${tyText(t)} cannot be sent as JSON: null would mean two things`;
    }
    return inner ? wireProblem(inner, d, seen) : null;
  }
  if (name === "List") return args[0] ? wireProblem(args[0], d, seen) : null;
  if (name === "Map") {
    if (!(args[0]?.k === "TName" && args[0].name === "String")) return `${tyText(t)} cannot be sent as JSON: map keys must be String`;
    return args[1] ? wireProblem(args[1], d, seen) : null;
  }
  if (name === "Table") return "a table cannot be sent as JSON";
  if (name === "Result") return `${tyText(t)} cannot be sent as JSON; only an api fn's return type may be a Result`;
  if (seen.has(name)) return null;
  const r = d.records.get(name);
  if (r) {
    if (r.params.length) return `${name} is generic, and wire types are not`;
    seen.add(name);
    for (const [f, ft] of r.fields) {
      if (PY_KEYWORDS.has(f) || f.startsWith("model_")) return `field ${name}.${f} cannot be a field name in the generated Python`;
      const p = wireProblem(ft, d, seen);
      if (p) return `${p} (in field ${name}.${f})`;
    }
    return null;
  }
  const s = d.sums.get(name);
  if (s) {
    if (s.params.length) return `${name} is generic, and wire types are not`;
    seen.add(name);
    for (const [vn, fs] of s.variants) {
      for (const [f, ft] of fs) {
        if (f === "kind") return `variant ${vn} has a field named kind, which the wire format uses for the variant's name`;
        if (PY_KEYWORDS.has(f) || f.startsWith("model_")) return `field ${vn}.${f} cannot be a field name in the generated Python`;
        const p = wireProblem(ft, d, seen);
        if (p) return `${p} (in variant ${vn})`;
      }
    }
    return null;
  }
  return `${name} is a type parameter or unknown type, and cannot be sent as JSON`;
}

/** The route's parameter names, or the reason the path is malformed. */
export function routeParams(path: string): string[] | { problem: string } {
  const names: string[] = [];
  const segs = path.split("/").slice(1);
  for (const seg of segs) {
    const m = PARAM_SEGMENT.exec(seg);
    if (m) {
      if (names.includes(m[1])) return { problem: `the path binds {${m[1]}} twice` };
      names.push(m[1]);
    } else if (!SEGMENT.test(seg)) {
      return { problem: `the path segment "${seg}" is not valid: use letters, digits, . _ ~ - or a whole {name}` };
    }
  }
  return names;
}

/** Method and path with parameter names erased: /todos/{id} and /todos/{todo_id} conflict. */
export function routeKey(r: A.Route): string {
  return `${r.method} ${r.path.replace(/\{[^}]*\}/g, "{}")}`;
}

function isScalarQuery(t: A.TypeExpr): boolean {
  if (t.k !== "TName") return false;
  if (SCALARS.has(t.name) && t.args.length === 0) return true;
  return t.name === "Option" && t.args.length === 1 && t.args[0].k === "TName" && SCALARS.has(t.args[0].name) && t.args[0].args.length === 0;
}

export function checkApi(prog: A.Program): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const d = decls(prog);
  const seenRoutes = new Map<string, A.Fn>();
  for (const it of prog.items) {
    if (it.k !== "Fn" || !it.route || isExtern(it)) continue;
    const a001 = (msg: string) => diags.push(diag("A001", `api fn ${it.name}: ${msg}`, it.line, it.col));
    const r = it.route;
    const key = routeKey(r);
    const prev = seenRoutes.get(key);
    if (prev) {
      diags.push(diag("A002", `api fn ${it.name}: ${r.method} ${r.path} is already the route of api fn ${prev.name}`, it.line, it.col));
    } else seenRoutes.set(key, it);
    if (it.tparams.length) a001("an api fn cannot be generic");
    const ps = routeParams(r.path);
    if (!Array.isArray(ps)) {
      a001(ps.problem);
      continue;
    }
    const params = new Map(it.params);
    for (const p of ps) {
      const t = params.get(p);
      if (!t) a001(`the path binds {${p}}, but the function has no parameter ${p}`);
      else if (!(t.k === "TName" && (t.name === "Int" || t.name === "String") && t.args.length === 0)) {
        a001(`the path parameter ${p} must be Int or String, not ${tyText(t)}`);
      }
    }
    for (const [p] of it.params) if (PY_KEYWORDS.has(p)) a001(`the parameter ${p} cannot be a parameter name in the generated Python`);
    const rest = it.params.filter(([p]) => !ps.includes(p));
    if (r.method === "GET" || r.method === "DELETE") {
      for (const [p, t] of rest) {
        if (!isScalarQuery(t)) {
          a001(`the query parameter ${p} must be Int, Float, Bool, String or an Option of one, not ${tyText(t)}; ${r.method} has no body`);
        }
      }
    } else if (rest.length > 1) {
      a001(`${r.method} takes at most one parameter besides the path parameters, a record sent as the JSON body; found ${rest.map(([p]) => p).join(", ")}`);
    } else if (rest.length === 1) {
      const [p, t] = rest[0];
      if (!(t.k === "TName" && d.records.has(t.name) && t.args.length === 0)) {
        a001(`the body parameter ${p} must be a record type, not ${tyText(t)}`);
      } else {
        const w = wireProblem(t, d);
        if (w) a001(w);
      }
    }
    const ret = it.ret;
    if (ret.k === "TName" && ret.name === "Result" && ret.args.length === 2) {
      const [ok, er] = ret.args;
      const w = wireProblem(ok, d);
      if (w) a001(w);
      if (!(er.k === "TName" && d.sums.has(er.name) && er.args.length === 0)) {
        a001(`the error type must be a sum type, so each error has a kind; found ${tyText(er)}`);
      } else {
        const w2 = wireProblem(er, d);
        if (w2) a001(w2);
      }
    } else {
      const w = wireProblem(ret, d);
      if (w) a001(w);
    }
    if (it.requires) diags.push(...portability(it, it.requires));
  }
  return diags;
}

/** A003: what an api fn's requires may use. */
function portability(fn: A.Fn, e: A.Expr): Diagnostic[] {
  const params = new Set(fn.params.map(([p]) => p));
  const out: Diagnostic[] = [];
  const bad = (what: string, at: A.Pos) => {
    if (out.length) return;
    const pos = at.line ? at : fn;
    out.push(diag("A003", `api fn ${fn.name}: its requires runs in the client too, so it cannot use ${what}; ` +
      `it may use comparisons, arithmetic, &&, ||, !, fields, literals and ${[...PORTABLE_CALLS].join(", ")}`, pos.line, pos.col));
  };
  for (const x of walkExprs(e)) {
    switch (x.k) {
      case "Int": case "Float": case "Str": case "Bool": case "FieldGet": case "Unary": case "ListLit":
        break;
      case "Binary":
      case "Name": // checked below, apart from callees
        break;
      case "Call": {
        if (x.callee.k !== "Name" || !PORTABLE_CALLS.has(x.callee.path[0])) {
          bad(`a call to ${x.callee.k === "Name" ? x.callee.path.join(".") : x.callee.name}`, x);
        }
        break;
      }
      case "Lambda": bad("a lambda", x); break;
      case "Match": bad("match", x); break;
      case "Ctor": bad(`the variant ${x.name}`, x); break;
      case "Record": bad(`a record literal (${x.tname})`, x); break;
      case "TupleLit": bad("a tuple", x); break;
      case "Try": bad("try", x); break;
      default: bad(x.k, x);
    }
  }
  // names other than parameters (a function used as a value, for instance)
  const callees = new Set([...walkExprs(e)].filter((x) => x.k === "Call").map((x) => x.callee));
  for (const x of walkExprs(e)) {
    if (x.k === "Name" && !callees.has(x) && !(x.path.length === 1 && params.has(x.path[0]))) bad(`the name ${x.path.join(".")}`, x);
  }
  return out;
}
