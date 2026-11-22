/** Normalizer: semantic no-ops an agent tends to write, collapsed to one form. */
import type * as A from "./ast.js";

export function normalizeExpr(e: A.Expr): A.Expr {
  switch (e.k) {
    case "Binary": {
      const l = normalizeExpr(e.left);
      const r = normalizeExpr(e.right);
      // x == true -> x ; x == false -> not x ; x != true -> not x ; x != false -> x
      if ((e.op === "==" || e.op === "!=") && (r.k === "Bool" || l.k === "Bool")) {
        const [b, other] = r.k === "Bool" ? [r, l] : [l as A.BoolLit, r];
        const positive = (e.op === "==") === b.value;
        return positive ? other : { k: "Unary", op: "not", operand: other, line: 0, col: 0 };
      }
      return { k: "Binary", op: e.op, left: l, right: r, line: e.line, col: e.col };
    }
    case "Unary": {
      const inner = normalizeExpr(e.operand);
      if (e.op === "not" && inner.k === "Unary" && inner.op === "not") return inner.operand;
      return { k: "Unary", op: e.op, operand: inner, line: e.line, col: e.col };
    }
    case "Call":
      return { ...e, args: e.args.map(normalizeExpr) };
    case "FieldGet":
      return { ...e, obj: normalizeExpr(e.obj) };
    case "Lambda":
      return { ...e, body: normalizeExpr(e.body) };
    case "ListLit":
    case "TupleLit":
      return { ...e, items: e.items.map(normalizeExpr) };
    case "Record":
      return { ...e, fields: e.fields.map(([n, v]) => [n, normalizeExpr(v)] as [string, A.Expr]) };
    case "Match":
      return {
        ...e,
        subject: normalizeExpr(e.subject),
        arms: e.arms.map(([p, v]) => [p, normalizeExpr(v)] as [A.Pattern, A.Expr]),
      };
    case "Try":
      return { ...e, expr: normalizeExpr(e.expr) };
    default:
      return e;
  }
}

export function normalizeStmts(stmts: A.Stmt[]): A.Stmt[] {
  return stmts.map((s): A.Stmt => {
    switch (s.k) {
      case "Let":
      case "Set":
        return { ...s, value: normalizeExpr(s.value) };
      case "Return":
        return s.value === null ? s : { ...s, value: normalizeExpr(s.value) };
      case "ExprStmt":
        return { ...s, expr: normalizeExpr(s.expr) };
      case "If":
        return {
          ...s,
          cond: normalizeExpr(s.cond),
          body: normalizeStmts(s.body),
          orelse: s.orelse === null ? null : normalizeStmts(s.orelse),
        };
      case "ForIn":
        return { ...s, iterable: normalizeExpr(s.iterable), body: normalizeStmts(s.body) };
      case "ForWhile":
        return { ...s, cond: normalizeExpr(s.cond), body: normalizeStmts(s.body) };
      default:
        return s;
    }
  });
}

/** Python's default string ordering (by code point), used for sorted(). */
export function cmpStr(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

function cmpPath(a: string[], b: string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = cmpStr(a[i], b[i]);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

export function normalize(prog: A.Program): A.Program {
  const items: A.Item[] = prog.items.map((it): A.Item => {
    if (it.k === "Fn") {
      return {
        ...it,
        effects: [...new Set(it.effects)].sort(cmpStr),
        requires: it.requires === null ? null : normalizeExpr(it.requires),
        ensures: it.ensures === null ? null : normalizeExpr(it.ensures),
        body: normalizeStmts(it.body),
      };
    }
    if (it.k === "Test") return { ...it, body: normalizeStmts(it.body) };
    return it;
  });
  // stable sort, like Python's sorted
  const uses = (items.filter((u) => u.k === "Use") as A.Use[])
    .map((u, i) => [u, i] as const)
    .sort((a, b) => cmpPath(a[0].path, b[0].path) || a[1] - b[1])
    .map(([u]) => u);
  const deduped: A.Use[] = [];
  for (const u of uses) {
    if (deduped.length === 0 || cmpPath(deduped[deduped.length - 1].path, u.path) !== 0) deduped.push(u);
  }
  const rest = items.filter((it) => it.k !== "Use");
  return { k: "Program", items: [...deduped, ...rest] };
}
