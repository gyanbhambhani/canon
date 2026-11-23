/**
 * The canonical printer for the Python-shaped surface, Canon-Py (docs/v0.4-design.md). It prints
 * the same AST as the brace printer; parsing its output gives back the same tree, so fmt is a
 * fixed point and one text per program still holds.
 */
import type * as A from "./ast.js";
import { CanonError, diag } from "./diagnostics.js";
import { features } from "./features.js";
import { MAX_LINE, floatText } from "./printer.js";
import { pyLen } from "./py.js";
import { sameNode } from "./pyparser.js";

export const PY_INDENT = "    ";

/** Python precedence, loosest first. */
const P = { lambda: 0, cond: 1, or: 2, and: 3, not: 4, cmp: 5, add: 6, mul: 7, unary: 8, postfix: 9, atom: 10 };
const BIN: Record<string, number> = {
  or: P.or, and: P.and, "==": P.cmp, "!=": P.cmp, "<": P.cmp, "<=": P.cmp, ">": P.cmp, ">=": P.cmp,
  "+": P.add, "-": P.add, "*": P.mul, "/": P.mul, "%": P.mul,
};
const CANON_TO_PY: Record<string, string> = {
  Int: "int", Float: "float", Bool: "bool", String: "str", Unit: "None", List: "list", Map: "dict",
};

const sortedEffects = (es: string[]) => [...new Set(es)].sort();

/** A match on a Bool with arms (True, a), (False, b): printed as `a if c else b`. */
export function isBoolChoice(m: A.Match): boolean {
  if (m.arms.length !== 2) return false;
  const [[p1], [p2]] = m.arms;
  return p1.k === "PLit" && p1.lit.k === "Bool" && p1.lit.value === true &&
    p2.k === "PLit" && p2.lit.k === "Bool" && p2.lit.value === false;
}

/** True when an expression contains no match that must be a statement. */
function inlineable(e: unknown): boolean {
  if (Array.isArray(e)) return e.every(inlineable);
  if (!e || typeof e !== "object") return true;
  const n = e as { k?: string };
  if (n.k === "Match" && !isBoolChoice(n as A.Match)) return false;
  return Object.values(n).every((v) => typeof v !== "object" || inlineable(v));
}

/** A function body's leading `var p = p` copies of mutated parameters (printed as nothing). */
export function paramCopies(fn: A.Fn): number {
  const params = new Set(fn.params.map(([n]) => n));
  let k = 0;
  const seen = new Set<string>();
  while (k < fn.body.length) {
    const s = fn.body[k];
    if (s.k === "Let" && s.mutable && s.value.k === "Name" && s.value.path.length === 1 && s.value.path[0] === s.name &&
      params.has(s.name) && !seen.has(s.name)) {
      seen.add(s.name);
      k++;
    } else break;
  }
  return k;
}

/** The identifier of a test: the test "adds two" is `test_adds_two`. */
export function testIdent(rawName: string): string {
  return "test_" + rawName.slice(1, -1).replace(/ /g, "_");
}

export class PyPrinter {
  ty(t: A.TypeExpr): string {
    switch (t.k) {
      case "TName": {
        const name = t.args.length === 0 && t.name === "Unit" ? "None" : CANON_TO_PY[t.name] ?? t.name;
        return name + (t.args.length ? `[${t.args.map((a) => this.ty(a)).join(", ")}]` : "");
      }
      case "TFn": {
        const eff = t.effects?.length ? `, ${sortedEffects(t.effects).join(" | ")}` : "";
        return `Callable[[${t.params.map((p) => this.ty(p)).join(", ")}], ${this.ty(t.ret)}${eff}]`;
      }
      case "TTuple":
        return `tuple[${t.items.map((i) => this.ty(i)).join(", ")}]`;
    }
  }

  ex(e: A.Expr, min = 0): string {
    const [s, p] = this.inner(e);
    return p < min ? `(${s})` : s;
  }

  /** The f-string form of a `+` chain of string literals and to_string calls, or null. */
  private fstring(e: A.Expr): string | null {
    if (e.k !== "Binary" || e.op !== "+") return null;
    const parts: A.Expr[] = [];
    let cur: A.Expr = e;
    while (cur.k === "Binary" && cur.op === "+") {
      parts.unshift(cur.right);
      cur = cur.left;
    }
    parts.unshift(cur);
    const isTs = (x: A.Expr) => x.k === "Call" && x.callee.k === "Name" && x.callee.path.length === 1 &&
      x.callee.path[0] === "to_string" && x.args.length === 1;
    if (!parts.every((x) => x.k === "Str" || isTs(x))) return null;
    if (!parts.some((x) => x.k === "Str") || !parts.some(isTs)) return null;
    let body = "";
    for (const x of parts) {
      if (x.k === "Str") body += x.raw.slice(1, -1).replace(/\{/g, "{{").replace(/\}/g, "}}");
      else body += `{${this.ex((x as A.Call).args[0], P.cond)}}`;
    }
    return `f"${body}"`;
  }

  private inner(e: A.Expr): [string, number] {
    switch (e.k) {
      case "Int":
        return [e.value, P.atom];
      case "Float":
        return [floatText(e.value), P.atom];
      case "Str":
        return [e.raw, P.atom];
      case "Bool":
        return [e.value ? "True" : "False", P.atom];
      case "Name":
        return [e.path.join("."), P.atom];
      case "Ctor":
        return [e.name, P.atom];
      case "Hole":
        return ["...", P.atom];
      case "Binary": {
        const f = this.fstring(e);
        if (f !== null) return [f, P.atom];
        const p = BIN[e.op];
        if ((e.op === "==" || e.op === "!=") && e.right.k === "Ctor" && e.right.name === "None") {
          return [`${this.ex(e.left, P.cmp + 1)} ${e.op === "==" ? "is" : "is not"} None`, P.cmp];
        }
        if (p === P.cmp) return [`${this.ex(e.left, p + 1)} ${e.op} ${this.ex(e.right, p + 1)}`, p];
        return [`${this.ex(e.left, p)} ${e.op} ${this.ex(e.right, p + 1)}`, p];
      }
      case "Unary":
        if (e.op === "not") {
          if (this.isContains(e.operand)) {
            const c = e.operand as A.Call;
            return [`${this.ex(c.args[1], P.cmp + 1)} not in ${this.ex(c.args[0], P.cmp + 1)}`, P.cmp];
          }
          return [`not ${this.ex(e.operand, P.not)}`, P.not];
        }
        return [`-${this.ex(e.operand, P.unary)}`, P.unary];
      case "Try":
        return [`${this.ex(e.expr, P.postfix)}?`, P.postfix];
      case "FieldGet":
        if (/^\d+$/.test(e.name)) return [`${this.ex(e.obj, P.postfix)}[${e.name}]`, P.postfix];
        return [`${this.ex(e.obj, P.postfix)}.${e.name}`, P.postfix];
      case "Lambda":
        return [`lambda${e.params.length ? " " + e.params.join(", ") : ""}: ${this.ex(e.body, P.cond)}`, P.lambda];
      case "ListLit":
        return [`[${e.items.map((x) => this.ex(x)).join(", ")}]`, P.atom];
      case "TupleLit":
        return [e.items.length === 1 ? `(${this.ex(e.items[0])},)` : `(${e.items.map((x) => this.ex(x)).join(", ")})`, P.atom];
      case "Record":
        return [`${e.tname}(${e.fields.map(([n, v]) => `${n}=${this.ex(v)}`).join(", ")})`, P.postfix];
      case "Match": {
        if (isBoolChoice(e)) {
          const [[, a], [, b]] = e.arms;
          return [`${this.ex(a, P.or)} if ${this.ex(e.subject, P.or)} else ${this.ex(b, P.cond)}`, P.cond];
        }
        throw new CanonError(diag("S001",
          "in Canon-Py a match is a statement: return its value or bind it to a name, then use the name",
          e.line, e.col));
      }
      case "Call": {
        if (this.isContains(e)) return [`${this.ex(e.args[1], P.cmp + 1)} in ${this.ex(e.args[0], P.cmp + 1)}`, P.cmp];
        return [`${this.ex(e.callee, P.postfix)}(${e.args.map((x) => this.ex(x)).join(", ")})`, P.postfix];
      }
    }
  }

  private isContains(e: A.Expr): boolean {
    return e.k === "Call" && e.callee.k === "Name" && e.callee.path.length === 1 && e.callee.path[0] === "contains" &&
      e.args.length === 2;
  }

  pat(p: A.Pattern): string {
    switch (p.k) {
      case "PWild":
        return "_";
      case "PBind":
        return p.name;
      case "PLit":
        return this.ex(p.lit);
      case "PCtor":
        return p.name + (p.args.length ? `(${p.args.map((a) => this.pat(a)).join(", ")})` : "");
      case "PTuple":
        return `(${p.items.map((a) => this.pat(a)).join(", ")})`;
    }
  }

  block(stmts: A.Stmt[], indent: string): string {
    const inner = indent + PY_INDENT;
    if (stmts.length === 0) return `${inner}pass`;
    return stmts.map((s) => this.stmt(s, inner)).join("\n");
  }

  /** `prefix` + value, wrapped when a line would pass MAX_LINE. */
  private valued(prefix: string, value: A.Expr, indent: string): string {
    if (!features().wrap) return prefix + this.ex(value);
    return this.wrap(prefix, value, "", indent);
  }

  /**
   * Black-style wrapping: when `prefix + e + suffix` is longer than MAX_LINE, break e's outermost
   * bracket (list, tuple, record or call arguments) one item per line with a trailing comma, and
   * wrap each item the same way. A lambda wraps its body. The result depends only on the tree.
   */
  private wrap(prefix: string, e: A.Expr, suffix: string, indent: string): string {
    const flat = prefix + this.ex(e) + suffix;
    if (pyLen(flat) <= MAX_LINE) return flat;
    const inner = indent + PY_INDENT;
    const items = (xs: [string, A.Expr][], open: string, close: string) =>
      `${prefix}${open}\n${xs.map(([p, x]) => this.wrap(inner + p, x, ",", inner)).join("\n")}\n${indent}${close}${suffix}`;
    switch (e.k) {
      case "ListLit":
        return e.items.length ? items(e.items.map((x) => ["", x]), "[", "]") : flat;
      case "TupleLit":
        return e.items.length >= 2 ? items(e.items.map((x) => ["", x]), "(", ")") : flat;
      case "Record":
        return e.fields.length ? items(e.fields.map(([n, v]) => [`${n}=`, v]), `${e.tname}(`, ")") : flat;
      case "Call":
        if (this.isContains(e) || e.args.length === 0) return flat;
        return items(e.args.map((x) => ["", x]), `${this.ex(e.callee, P.postfix)}(`, ")");
      case "Lambda":
        if (e.body.k === "Lambda" || this.inner(e.body)[1] < P.cond) return flat;
        return this.wrap(`${prefix}lambda${e.params.length ? " " + e.params.join(", ") : ""}: `, e.body, suffix, indent);
      default:
        return flat;
    }
  }

  /** How one arm's value is stated, for a match printed as a statement. */
  private armStmt(kind: "return" | "assign" | "call", target: A.Expr | null, v: A.Expr, indent: string): string {
    if (v.k === "Match" && !(isBoolChoice(v) && inlineable(v))) return this.matchStmt(kind, target, v, indent);
    if (kind === "return") return this.valued(`${indent}return `, v, indent);
    if (kind === "call") return this.valued(indent, v, indent);
    return this.assign(target!, v, indent);
  }

  private matchStmt(kind: "return" | "assign" | "call", target: A.Expr | null, m: A.Match, indent: string): string {
    const lines = [`${indent}match ${this.ex(m.subject, P.cond)}:`];
    for (const [pat, v] of m.arms) {
      lines.push(`${indent}${PY_INDENT}case ${this.pat(pat)}:`);
      lines.push(this.armStmt(kind, target, v, indent + PY_INDENT + PY_INDENT));
    }
    return lines.join("\n");
  }

  private assign(target: A.Expr, v: A.Expr, indent: string): string {
    const t = this.ex(target);
    if (v.k === "Binary" && ["+", "-", "*", "/", "%"].includes(v.op) && sameNode(v.left, target) && this.fstring(v) === null) {
      return this.valued(`${indent}${t} ${v.op}= `, v.right, indent);
    }
    return this.valued(`${indent}${t} = `, v, indent);
  }

  private needsStatement(v: A.Expr): boolean {
    return v.k === "Match" && !(isBoolChoice(v) && inlineable(v));
  }

  stmt(s: A.Stmt, indent: string): string {
    switch (s.k) {
      case "Comment":
        return indent + s.text;
      case "Break":
        return indent + "break";
      case "Let": {
        const target: A.Expr = { k: "Name", path: [s.name], line: s.line, col: s.col };
        if (this.needsStatement(s.value)) return this.matchStmt("assign", target, s.value as A.Match, indent);
        return this.valued(`${indent}${s.name} = `, s.value, indent);
      }
      case "Set":
        if (this.needsStatement(s.value)) return this.matchStmt("assign", s.target, s.value as A.Match, indent);
        return this.assign(s.target, s.value, indent);
      case "Return":
        if (s.value === null) return indent + "return";
        if (this.needsStatement(s.value)) return this.matchStmt("return", null, s.value as A.Match, indent);
        return this.valued(`${indent}return `, s.value, indent);
      case "ExprStmt": {
        const e = s.expr;
        if (this.needsStatement(e)) return this.matchStmt("call", null, e as A.Match, indent);
        if (e.k === "Call" && e.callee.k === "Name" && e.callee.path.length === 1 && e.callee.path[0] === "assert" && e.args.length === 1) {
          return this.valued(`${indent}assert `, e.args[0], indent);
        }
        return this.valued(indent, e, indent);
      }
      case "If":
        return this.ifText(s, indent, "if");
      case "ForIn": {
        const v = s.names ? s.names.join(", ") : s.var;
        return `${indent}for ${v} in ${this.ex(s.iterable, P.cond)}:\n${this.block(s.body, indent)}`;
      }
      case "ForWhile":
        return `${indent}while ${this.ex(s.cond, P.cond)}:\n${this.block(s.body, indent)}`;
    }
  }

  private ifText(s: A.If, indent: string, kw: string): string {
    let text = `${indent}${kw} ${this.ex(s.cond, P.cond)}:\n${this.block(s.body, indent)}`;
    if (s.orelse !== null) {
      if (s.orelse.length === 1 && s.orelse[0].k === "If") text += "\n" + this.ifText(s.orelse[0], indent, "elif");
      else text += `\n${indent}else:\n${this.block(s.orelse, indent)}`;
    }
    return text;
  }

  item(it: A.Item): string {
    switch (it.k) {
      case "Comment":
        return it.text;
      case "Use":
        return "import " + it.path.join(".");
      case "RecordType": {
        const tp = it.params.length ? `[${it.params.join(", ")}]` : "";
        const fields = it.fields.length ? it.fields.map(([n, t]) => `${PY_INDENT}${n}: ${this.ty(t)}`) : [`${PY_INDENT}pass`];
        return [`class ${it.name}${tp}:`, ...fields].join("\n");
      }
      case "SumType": {
        const tp = it.params.length ? `[${it.params.join(", ")}]` : "";
        const vs = it.variants.map(([vn, fs]) => vn + (fs.length ? `(${fs.map(([n, t]) => `${n}: ${this.ty(t)}`).join(", ")})` : ""));
        const flat = `type ${it.name}${tp} = ${vs.join(" | ")}`;
        if (pyLen(flat) <= MAX_LINE) return flat;
        return [`type ${it.name}${tp} = (`, `${PY_INDENT}${vs[0]}`, ...vs.slice(1).map((v) => `${PY_INDENT}| ${v}`), ")"].join("\n");
      }
      case "Fn": {
        const deco: string[] = [];
        if (it.effects.length) deco.push(`@effects(${it.effects.join(", ")})`);
        if (it.requires !== null) deco.push(`@requires(${this.ex(it.requires)})`);
        if (it.ensures !== null) deco.push(`@ensures(${this.ex(it.ensures)})`);
        const tp = it.tparams.length ? `[${it.tparams.join(", ")}]` : "";
        const ps = it.params.map(([n, t]) => `${n}: ${this.ty(t)}`);
        let head = `def ${it.name}${tp}(${ps.join(", ")}) -> ${this.ty(it.ret)}:`;
        if (features().wrap && pyLen(head) > MAX_LINE && ps.length) {
          // Black-style: one parameter per line
          head = `def ${it.name}${tp}(\n${ps.map((p) => `${PY_INDENT}${p},`).join("\n")}\n) -> ${this.ty(it.ret)}:`;
        }
        return [...deco, head, this.block(it.body.slice(paramCopies(it)), "")].join("\n");
      }
      case "Test": {
        const deco = it.effects.length ? [`@effects(${it.effects.join(", ")})`] : [];
        return [...deco, `def ${testIdent(it.name)}() -> None:`, this.block(it.body, "")].join("\n");
      }
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
