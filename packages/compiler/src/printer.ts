/** Canonical printer. With a noise source it emits equivalent non-canonical variants (tests). */
import type * as A from "./ast.js";
import { CanonError, diag } from "./diagnostics.js";
import { pyFloatRepr } from "./py.js";

export const PREC: Record<string, number> = {
  pipe: 0, or: 1, and: 2, not: 3, "==": 4, "!=": 4, "<": 4, "<=": 4, ">": 4, ">=": 4,
  "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, unary: 7, postfix: 8, atom: 9,
};
export const PIPELINE_MIN_STAGES = 3;
export const INDENT = "  ";
export const MAX_LINE = 100;

export function isScalarLiteral(e: A.Expr): boolean {
  if (e.k === "Unary" && e.op === "-") return isScalarLiteral(e.operand);
  return e.k === "Int" || e.k === "Float" || e.k === "Str" || e.k === "Bool";
}

/**
 * A call that can be a pipeline stage: a lowercase function with >= 1 argument whose
 * first argument is not a scalar literal (so range(0, n) never becomes 0 |> range(n)).
 */
export function chainEligible(e: A.Expr): e is A.Call {
  return e.k === "Call" && e.callee.k === "Name" && e.args.length >= 1 && !isScalarLiteral(e.args[0]);
}

export function unrollChain(e: A.Expr): [A.Expr, A.Call[]] {
  const stages: A.Call[] = [];
  let cur = e;
  while (chainEligible(cur)) {
    stages.push(cur);
    cur = cur.args[0];
  }
  return [cur, stages.reverse()];
}

export function floatText(v: number): string {
  return pyFloatRepr(v);
}

export interface Noise {
  random(): number;
}

export class Printer {
  constructor(private readonly noise: Noise | null = null) {}

  private coin(p = 0.5): boolean {
    return this.noise !== null && this.noise.random() < p;
  }

  ty(t: A.TypeExpr): string {
    switch (t.k) {
      case "TName":
        return t.name + (t.args.length ? `[${t.args.map((a) => this.ty(a)).join(", ")}]` : "");
      case "TFn":
        return `fn(${t.params.map((p) => this.ty(p)).join(", ")}) -> ${this.ty(t.ret)}`;
      case "TTuple":
        return `(${t.items.map((i) => this.ty(i)).join(", ")})`;
    }
  }

  ex(e: A.Expr, minPrec = 0, indent = "", stmt = false): string {
    let noisyPipe: boolean | null = null;
    if (this.noise !== null && e.k === "Call" && chainEligible(e)) noisyPipe = this.coin(0.5);
    const [s, p] = this.exInner(e, indent, stmt, noisyPipe);
    if (p < minPrec) return `(${s})`;
    if (this.noise !== null && p < PREC.atom && !stmt && this.coin(0.25)) return `(${s})`;
    return s;
  }

  private exInner(e: A.Expr, indent: string, stmt: boolean, noisyPipe: boolean | null): [string, number] {
    switch (e.k) {
      case "Int":
        return [e.value, PREC.atom];
      case "Float":
        return [floatText(e.value), PREC.atom];
      case "Str":
        return [e.raw, PREC.atom];
      case "Bool":
        return [e.value ? "true" : "false", PREC.atom];
      case "Name":
        return [e.path.join("."), PREC.atom];
      case "Ctor":
        return [e.name, PREC.atom];
      case "Hole":
        return ["?" + e.name, PREC.atom];
      case "Binary": {
        const p = PREC[e.op];
        let l: string;
        let r: string;
        if (p === 4) {
          l = this.ex(e.left, p + 1, indent);
          r = this.ex(e.right, p + 1, indent);
        } else {
          l = this.ex(e.left, p, indent);
          r = this.ex(e.right, p + 1, indent);
        }
        return [`${l} ${e.op} ${r}`, p];
      }
      case "Unary":
        if (e.op === "not") return [`not ${this.ex(e.operand, PREC.not, indent)}`, PREC.not];
        return [`-${this.ex(e.operand, PREC.unary, indent)}`, PREC.unary];
      case "Try":
        return [`try ${this.ex(e.expr, PREC.unary, indent)}`, PREC.unary];
      case "FieldGet":
        return [`${this.ex(e.obj, PREC.postfix, indent)}.${e.name}`, PREC.postfix];
      case "Lambda":
        return [`|${e.params.join(", ")}| ${this.ex(e.body, 1, indent)}`, PREC.pipe];
      case "ListLit":
        return [`[${this.items(e.items, indent)}]`, PREC.atom];
      case "TupleLit":
        return [`(${this.items(e.items, indent)})`, PREC.atom];
      case "Record": {
        const inner = e.fields.map(([n, v]) => `${n}: ${this.ex(v, 0, indent)}`).join(", ");
        return [inner ? `${e.tname} { ${inner} }` : `${e.tname} {}`, PREC.atom];
      }
      case "Match": {
        if (!stmt) {
          throw new CanonError(diag("S001",
            "match is only allowed as a whole statement value (let, set, return); bind it with let first",
            e.line, e.col));
        }
        const lines = [`match ${this.ex(e.subject, 1, indent)} {`];
        for (const [pat, val] of e.arms) {
          lines.push(`${indent}${INDENT}${this.pat(pat)} => ${this.ex(val, 0, indent + INDENT)},`);
        }
        lines.push(`${indent}}`);
        return [lines.join("\n"), PREC.atom];
      }
      case "Call": {
        const [head, stages] = unrollChain(e);
        let usePipe = stages.length >= PIPELINE_MIN_STAGES;
        if (noisyPipe !== null) usePipe = noisyPipe && stages.length >= 1;
        if (usePipe) {
          const headS = this.ex(head, 1, indent);
          const parts = stages.map((st) => `|> ${(st.callee as A.Name).path.join(".")}(${this.items(st.args.slice(1), indent)})`);
          if (stmt && this.noise === null) {
            const sep = "\n" + indent + INDENT;
            return [headS + sep + parts.join(sep), PREC.pipe];
          }
          return [headS + " " + parts.join(" "), PREC.pipe];
        }
        const callee = this.ex(e.callee, PREC.postfix, indent);
        return [`${callee}(${this.items(e.args, indent)})`, PREC.postfix];
      }
    }
  }

  private items(xs: A.Expr[], indent: string): string {
    let s = xs.map((x) => this.ex(x, 0, indent)).join(", ");
    if (xs.length && this.coin(0.2)) s += ",";
    return s;
  }

  pat(p: A.Pattern): string {
    switch (p.k) {
      case "PWild":
        return "_";
      case "PBind":
        return p.name;
      case "PLit":
        // parens are not legal around a pattern literal, so noise never applies here
        return this.noise === null ? this.ex(p.lit, 0) : new Printer().ex(p.lit, 0);
      case "PCtor":
        return p.name + (p.args.length ? `(${p.args.map((a) => this.pat(a)).join(", ")})` : "");
      case "PTuple":
        return `(${p.items.map((a) => this.pat(a)).join(", ")})`;
    }
  }

  block(stmts: A.Stmt[], indent: string): string {
    if (stmts.length === 0) return "{}";
    const inner = indent + INDENT;
    const lines = ["{"];
    for (const s of stmts) lines.push(this.stmt(s, inner));
    lines.push(indent + "}");
    return lines.join("\n");
  }

  stmt(s: A.Stmt, indent: string): string {
    switch (s.k) {
      case "Comment":
        return indent + s.text;
      case "Let":
        return `${indent}${s.mutable ? "var" : "let"} ${s.name} = ${this.ex(s.value, 0, indent, true)}`;
      case "Set":
        return `${indent}set ${this.ex(s.target, 0, indent)} = ${this.ex(s.value, 0, indent, true)}`;
      case "Return":
        if (s.value === null) return indent + "return";
        return `${indent}return ${this.ex(s.value, 0, indent, true)}`;
      case "ExprStmt":
        return indent + this.ex(s.expr, 0, indent, true);
      case "If":
        return indent + this.ifText(s, indent);
      case "ForIn":
        return `${indent}for ${s.var} in ${this.ex(s.iterable, 1, indent)} ${this.block(s.body, indent)}`;
      case "ForWhile":
        return `${indent}for ${this.ex(s.cond, 1, indent)} ${this.block(s.body, indent)}`;
    }
  }

  private ifText(s: A.If, indent: string): string {
    let text = `if ${this.ex(s.cond, 1, indent)} ${this.block(s.body, indent)}`;
    if (s.orelse !== null) {
      if (s.orelse.length === 1 && s.orelse[0].k === "If" && !this.coin(0.3)) {
        text += " else " + this.ifText(s.orelse[0], indent);
      } else {
        text += " else " + this.block(s.orelse, indent);
      }
    }
    return text;
  }

  item(it: A.Item): string {
    switch (it.k) {
      case "Comment":
        return it.text;
      case "Use":
        return "use " + it.path.join(".");
      case "RecordType": {
        const tp = it.params.length ? `[${it.params.join(", ")}]` : "";
        const lines = [`type ${it.name}${tp} {`];
        for (const [n, t] of it.fields) lines.push(`${INDENT}${n}: ${this.ty(t)},`);
        lines.push("}");
        return lines.join("\n");
      }
      case "SumType": {
        const tp = it.params.length ? `[${it.params.join(", ")}]` : "";
        const lines = [`type ${it.name}${tp} =`];
        for (const [vn, fs] of it.variants) {
          const args = fs.length ? `(${fs.map(([n, t]) => `${n}: ${this.ty(t)}`).join(", ")})` : "";
          lines.push(`${INDENT}| ${vn}${args}`);
        }
        return lines.join("\n");
      }
      case "Fn": {
        const tp = it.tparams.length ? `[${it.tparams.join(", ")}]` : "";
        const params = it.params.map(([n, t]) => `${n}: ${this.ty(t)}`).join(", ");
        const head = `fn ${it.name}${tp}(${params}) -> ${this.ty(it.ret)}`;
        const clauses: string[] = [];
        if (it.effects.length) clauses.push(`${INDENT}effects: ${it.effects.join(", ")}`);
        if (it.requires !== null) clauses.push(`${INDENT}requires: ${this.ex(it.requires, 1)}`);
        if (it.ensures !== null) clauses.push(`${INDENT}ensures: ${this.ex(it.ensures, 1)}`);
        const body = this.block(it.body, "");
        if (clauses.length) return [head, ...clauses, body].join("\n");
        return `${head} ${body}`;
      }
      case "Test":
        return `test ${it.name} ${this.block(it.body, "")}`;
    }
  }

  program(prog: A.Program): string {
    const out: string[] = [];
    let prev: A.Item | null = null;
    for (const it of prog.items) {
      const text = this.item(it);
      if (prev !== null) {
        const tight = (prev.k === "Use" && it.k === "Use") || prev.k === "Comment";
        out.push(tight ? "\n" : "\n\n");
      }
      out.push(text);
      prev = it;
    }
    return out.length ? out.join("") + "\n" : "";
  }
}
