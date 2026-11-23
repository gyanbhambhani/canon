/**
 * Normalization for the Canon-Py surface (applied when the `py` switch is on, after the shared
 * normalizer). It rewrites only what Canon-Py cannot spell, and always preserves meaning:
 *  - mutability is inferred: a `var` that is never assigned becomes immutable, and an assigned `let` a var;
 *  - `let x = x` is dropped (it rebinds the same value);
 *  - a `let` that shadows a visible name is renamed `name_2` (Canon-Py has no shadowing: the second
 *    `x = ...` would be an assignment);
 *  - hole names are dropped (`...` has none);
 *  - test names become what a `def test_...` identifier can say;
 *  - a match on a Bool with arms true/false (or one literal and `_`) is put in the order
 *    true, false, so that it prints as `a if c else b`.
 */
import type * as A from "./ast.js";
import { FIELDS } from "./ast.js";

type Env = Map<string, string>;

function boolArms(m: A.Match): A.Match {
  if (m.arms.length !== 2) return m;
  const lit = (p: A.Pattern) => (p.k === "PLit" && p.lit.k === "Bool" ? p.lit.value : null);
  const [[p1, a], [p2, b]] = m.arms;
  const v1 = lit(p1);
  if (v1 === null) return m;
  const v2 = lit(p2);
  if (!(v2 === !v1 || (v2 === null && p2.k === "PWild"))) return m;
  const pat = (value: boolean, at: A.Pos): A.Pattern => ({ k: "PLit", lit: { k: "Bool", value, line: at.line, col: at.col }, line: at.line, col: at.col });
  const [t, f] = v1 ? [a, b] : [b, a];
  return { ...m, arms: [[pat(true, p1), t], [pat(false, p2), f]] };
}

/** Rewrite an expression: rename free names per env, drop hole names, order bool matches. */
function rewrite(e: A.Expr, env: Env): A.Expr {
  switch (e.k) {
    case "Name":
      if (e.path.length === 1 && env.has(e.path[0])) return { ...e, path: [env.get(e.path[0])!] };
      return e;
    case "Hole":
      return e.name ? { ...e, name: "" } : e;
    case "Lambda": {
      const inner = new Map(env);
      for (const p of e.params) inner.delete(p);
      return { ...e, body: rewrite(e.body, inner) };
    }
    case "Match": {
      const m = boolArms(e);
      return {
        ...m,
        subject: rewrite(m.subject, env),
        arms: m.arms.map(([p, v]) => {
          const inner = new Map(env);
          for (const n of patternNames(p)) inner.delete(n);
          return [p, rewrite(v, inner)] as [A.Pattern, A.Expr];
        }),
      };
    }
    default: {
      const out: Record<string, unknown> = { ...e };
      for (const f of FIELDS[e.k] ?? []) {
        const v = (e as unknown as Record<string, unknown>)[f];
        if (Array.isArray(v)) {
          out[f] = v.map((x) => (Array.isArray(x) ? [x[0], rewrite(x[1], env)] : rewrite(x, env)));
        } else if (v && typeof v === "object") {
          out[f] = rewrite(v as A.Expr, env);
        }
      }
      return out as unknown as A.Expr;
    }
  }
}

function patternNames(p: A.Pattern): string[] {
  switch (p.k) {
    case "PBind":
      return [p.name];
    case "PCtor":
      return p.args.flatMap(patternNames);
    case "PTuple":
      return p.items.flatMap(patternNames);
    default:
      return [];
  }
}

/** Every identifier used in a value (to pick fresh names that collide with nothing). */
function allNames(x: unknown, out: Set<string>) {
  if (Array.isArray(x)) {
    for (const y of x) allNames(y, out);
    return;
  }
  if (!x || typeof x !== "object") return;
  const n = x as Record<string, unknown>;
  if (n.k === "Name") for (const p of n.path as string[]) out.add(p);
  if ((n.k === "Let" || n.k === "PBind") && typeof n.name === "string") out.add(n.name);
  if (n.k === "Lambda") for (const p of n.params as string[]) out.add(p);
  if (n.k === "ForIn") {
    if (n.var) out.add(n.var as string);
    for (const v of (n.names as string[] | undefined) ?? []) out.add(v);
  }
  for (const v of Object.values(n)) if (typeof v === "object") allNames(v, out);
}

interface Scope {
  names: Env; // source name -> printed name
  lets: Map<string, A.Let>; // printed name -> binding (for mutability)
}

function body(stmts: A.Stmt[], params: string[], isFn: boolean): A.Stmt[] {
  const used = new Set<string>(params);
  allNames(stmts, used);
  const fresh = (base: string) => {
    let k = 2;
    while (used.has(`${base}_${k}`)) k++;
    used.add(`${base}_${k}`);
    return `${base}_${k}`;
  };
  const scopes: Scope[] = [{ names: new Map(params.map((p) => [p, p])), lets: new Map() }];
  const assigned = new Set<A.Let>();
  const env = (): Env => {
    const m: Env = new Map();
    for (const s of scopes) for (const [k, v] of s.names) m.set(k, v);
    return m;
  };
  const visible = (n: string) => scopes.some((s) => s.names.has(n));
  const letOf = (printed: string): A.Let | undefined => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const l = scopes[i].lets.get(printed);
      if (l) return l;
      if ([...scopes[i].names.values()].includes(printed)) return undefined;
    }
    return undefined;
  };
  const rootName = (e: A.Expr): string | null => {
    while (e.k === "FieldGet") e = e.obj;
    return e.k === "Name" && e.path.length === 1 ? e.path[0] : null;
  };

  const walk = (ss: A.Stmt[], top: boolean, fresh_: Map<string, string> | null): A.Stmt[] => {
    scopes.push({ names: fresh_ ?? new Map(), lets: new Map() });
    const cur = scopes[scopes.length - 1];
    const out: A.Stmt[] = [];
    let prefix = top;
    for (const s of ss) {
      const e = env();
      switch (s.k) {
        case "Let": {
          const value = rewrite(s.value, e);
          const sameName = value.k === "Name" && value.path.length === 1 && value.path[0] === (e.get(s.name) ?? s.name);
          const isParamCopy = prefix && isFn && s.mutable && sameName && params.includes(s.name) && scopes[0].names.get(s.name) === s.name;
          if (!isParamCopy) prefix = false;
          if (visible(s.name)) {
            if (!s.mutable && sameName) continue; // let x = x
            if (isParamCopy) {
              const node: A.Let = { ...s, value };
              cur.names.set(s.name, s.name);
              cur.lets.set(s.name, node);
              out.push(node);
              continue;
            }
            const nn = fresh(s.name);
            const node: A.Let = { ...s, name: nn, value };
            cur.names.set(s.name, nn);
            cur.lets.set(nn, node);
            out.push(node);
            continue;
          }
          const node: A.Let = { ...s, value };
          cur.names.set(s.name, s.name);
          cur.lets.set(s.name, node);
          out.push(node);
          continue;
        }
        case "Set": {
          prefix = false;
          const target = rewrite(s.target, e);
          const root = rootName(target);
          if (root !== null) {
            const l = letOf(root);
            if (l) assigned.add(l);
          }
          out.push({ ...s, target, value: rewrite(s.value, e) });
          continue;
        }
        case "Return":
          prefix = false;
          out.push(s.value === null ? s : { ...s, value: rewrite(s.value, e) });
          continue;
        case "ExprStmt":
          prefix = false;
          out.push({ ...s, expr: rewrite(s.expr, e) });
          continue;
        case "If":
          prefix = false;
          out.push({ ...s, cond: rewrite(s.cond, e), body: walk(s.body, false, null), orelse: s.orelse === null ? null : walk(s.orelse, false, null) });
          continue;
        case "ForIn": {
          prefix = false;
          const names = s.names ?? [s.var];
          out.push({ ...s, iterable: rewrite(s.iterable, e), body: walk(s.body, false, new Map(names.map((n) => [n, n]))) });
          continue;
        }
        case "ForWhile":
          prefix = false;
          out.push({ ...s, cond: rewrite(s.cond, e), body: walk(s.body, false, null) });
          continue;
        default:
          out.push(s);
      }
    }
    scopes.pop();
    return out;
  };

  const result = walk(stmts, true, null);
  // a var that is never assigned is immutable; an unassigned parameter copy is just the parameter
  const fix = (ss: A.Stmt[]): A.Stmt[] => ss.flatMap((s): A.Stmt[] => {
    if (s.k === "Let") {
      // Canon-Py infers mutability: an assigned binding is a var
      if (!s.mutable && assigned.has(s)) s.mutable = true;
      if (s.mutable && !assigned.has(s)) {
        if (s.value.k === "Name" && s.value.path.length === 1 && s.value.path[0] === s.name) return [];
        s.mutable = false;
      }
      return [s];
    }
    if (s.k === "If") return [{ ...s, body: fix(s.body), orelse: s.orelse === null ? null : fix(s.orelse) }];
    if (s.k === "ForIn" || s.k === "ForWhile") return [{ ...s, body: fix(s.body) }];
    return [s];
  });
  return fix(result);
}

/** A test name that a `def test_...` identifier can carry. */
export function pyTestName(raw: string): string {
  const id = raw.slice(1, -1).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `"${id.replace(/_/g, " ")}"`;
}

export function pyNormalize(prog: A.Program): A.Program {
  return {
    ...prog,
    items: prog.items.map((it): A.Item => {
      if (it.k === "Fn") {
        return {
          ...it,
          requires: it.requires === null ? null : rewrite(it.requires, new Map()),
          ensures: it.ensures === null ? null : rewrite(it.ensures, new Map()),
          body: body(it.body, it.params.map(([n]) => n), true),
        };
      }
      if (it.k === "Test") return { ...it, name: pyTestName(it.name), body: body(it.body, [], false) };
      return it;
    }),
  };
}
