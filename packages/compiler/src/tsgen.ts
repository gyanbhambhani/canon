/**
 * v0.5 M4: the TypeScript client generator. From a checked project it writes, for the frontend:
 *   types.ts     an interface per wire record, a union on `kind` per wire sum type
 *   validate.ts  one validator per api fn with a requires, the same rule the server enforces
 *   client.ts    createClient(baseUrl): one async method per api fn, returning a Result
 *   runtime.ts   the small fixed runtime those files import (no dependencies)
 *
 * The text is emitted already formatted as prettier formats it (printWidth 100), because the
 * compiler has no dependencies and runs in the browser.
 */
import type * as A from "./ast.js";
import { isExtern } from "./ast.js";
import { routeParams } from "./api.js";
import { finishGenerated, type GeneratedFile } from "./generated.js";
import { ruleText } from "./manifest.js";
import type { ProjectResult } from "./project.js";
import { resolve, type Type, type TypeInfo } from "./types.js";

const WIDTH = 100;

/**
 * The whitespace trim() removes in every generated runtime: exactly JavaScript's
 * String.prototype.trim set (WhiteSpace and LineTerminator). The Python runtime copies it.
 */
export const TRIM_WHITESPACE =
  "\t\n\u000b\u000c\r                  　﻿";

// ------------------------------------------------------------------------------------ names

const TS_RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum",
  "export", "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "new", "null",
  "return", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
  "let", "static", "implements", "interface", "package", "private", "protected", "public", "await", "arguments", "eval",
]);

/** `per_page` is `perPage`; leading and doubled underscores are kept. */
export function camel(s: string): string {
  return s.replace(/([a-z0-9])_+([a-z0-9])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

const pascal = (s: string) => {
  const c = camel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
};

/** Names a generated function body uses besides its parameters. */
const TAKEN = new Set(["baseUrl", "invalid", "request", "strLen", "trim", "contains", "isEmail", "div", "eq", "compareStrings"]);

function paramName(p: string): string {
  const c = camel(p);
  return TS_RESERVED.has(c) || TAKEN.has(c) ? `${c}_` : c;
}

/** Display width as prettier measures it: wide (East Asian and emoji) characters count 2. */
function width(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const wide =
      (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1f64f) || (c >= 0x1f680 && c <= 0x1f6ff) ||
      (c >= 0x1f900 && c <= 0x1f9ff) || (c >= 0x20000 && c <= 0x3fffd);
    w += wide ? 2 : 1;
  }
  return w;
}

/** A string literal as prettier writes it: double quotes, unless the text has more of them than singles. */
export function tsString(value: string): string {
  const doubles = (value.match(/"/g) ?? []).length;
  const singles = (value.match(/'/g) ?? []).length;
  const json = JSON.stringify(value);
  if (doubles <= singles) return json;
  return "'" + json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";
}

/** A Canon string literal's value (its escapes are JSON's). */
function strValue(raw: string): string {
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw.slice(1, -1);
  }
}

/** A number as prettier writes it (`1e21`, not `1e+21`). */
const numText = (v: number) => String(v).replace("e+", "e");
const fits = (s: string) => width(s) <= WIDTH;
const sortNames = (xs: string[]) =>
  [...new Set(xs)].sort((a, b) => {
    const x = a.replace(/^type /, "").toLowerCase();
    const y = b.replace(/^type /, "").toLowerCase();
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
  });

// ------------------------------------------------------------------------------------ types

function tsType(t: A.TypeExpr): string {
  if (t.k === "TTuple") return `[${t.items.map(tsType).join(", ")}]`;
  if (t.k === "TFn") throw new Error("internal: a function type is not a wire type");
  switch (t.name) {
    case "Int":
    case "Float":
      return "number";
    case "Bool":
      return "boolean";
    case "String":
      return "string";
    case "Unit":
      return "null";
    case "Option":
      return `${tsType(t.args[0])} | null`;
    case "List": {
      const inner = tsType(t.args[0]);
      return /\s\|\s/.test(inner) && !inner.startsWith("[") ? `(${inner})[]` : `${inner}[]`;
    }
    case "Map":
      return `Record<string, ${tsType(t.args[1])}>`;
    default:
      return t.name;
  }
}

/** A field or parameter list on one line: `{ a: T; b: U }`. */
function objectType(fields: [string, string][]): string {
  return fields.length ? `{ ${fields.map(([n, t]) => `${n}: ${t}`).join("; ")} }` : "{}";
}

// ------------------------------------------------------------------------------------ the project

interface Endpoint {
  fn: A.Fn;
  info: TypeInfo;
}

interface Decls {
  records: Map<string, A.RecordType>;
  sums: Map<string, A.SumType>;
  /** Declaration order: modules in dependency order, items in source order. */
  order: string[];
}

function collect(project: ProjectResult): { endpoints: Endpoint[]; decls: Decls } {
  const endpoints: Endpoint[] = [];
  const decls: Decls = { records: new Map(), sums: new Map(), order: [] };
  for (const m of project.modules) {
    const prog = m.analysis.prog;
    if (!prog) continue;
    for (const it of prog.items) {
      if (isExtern(it)) continue;
      if (it.k === "RecordType") {
        decls.records.set(it.name, it);
        decls.order.push(it.name);
      } else if (it.k === "SumType") {
        decls.sums.set(it.name, it);
        decls.order.push(it.name);
      } else if (it.k === "Fn" && it.route) {
        endpoints.push({ fn: it, info: m.analysis.info! });
      }
    }
  }
  if (!decls.records.has("Error")) {
    decls.records.set("Error", {
      k: "RecordType", name: "Error", params: [], line: 0, col: 0,
      fields: [["message", { k: "TName", name: "String", args: [], line: 0, col: 0 }]],
    });
    decls.order.unshift("Error");
  }
  return { endpoints, decls };
}

/** Every record and sum type reachable from the api fns' signatures. */
function reachable(endpoints: Endpoint[], decls: Decls): Set<string> {
  const seen = new Set<string>();
  const visit = (t: A.TypeExpr) => {
    if (t.k === "TTuple") return t.items.forEach(visit);
    if (t.k === "TFn") return;
    t.args.forEach(visit);
    if (seen.has(t.name)) return;
    const r = decls.records.get(t.name);
    const s = decls.sums.get(t.name);
    if (r) {
      seen.add(t.name);
      r.fields.forEach(([, ft]) => visit(ft));
    } else if (s) {
      seen.add(t.name);
      s.variants.forEach(([, fs]) => fs.forEach(([, ft]) => visit(ft)));
    }
  };
  for (const { fn } of endpoints) {
    fn.params.forEach(([, t]) => visit(t));
    visit(fn.ret);
  }
  return seen;
}

/** The header's source: the one module's file, or the folder holding every module. */
function sourceOf(project: ProjectResult): string {
  const paths = project.modules.map((m) => m.path.replace(/\\/g, "/"));
  if (paths.length === 1) return paths[0];
  const dirs = paths.map((p) => p.split("/").slice(0, -1));
  const common: string[] = [];
  for (let i = 0; dirs.every((d) => i < d.length && d[i] === dirs[0][i]); i++) common.push(dirs[0][i]);
  return common.length ? `the Canon modules in ${common.join("/")}/` : "the project's Canon modules";
}

// ------------------------------------------------------------------------------------ formatting

/** `import { a, type B } from "./x";`, one name per line when it does not fit. */
function importLine(names: string[], from: string, typeOnly = false): string {
  const kw = typeOnly ? "import type" : "import";
  const sorted = sortNames(names);
  const flat = `${kw} { ${sorted.join(", ")} } from "${from}";`;
  if (fits(flat)) return flat;
  return `${kw} {\n${sorted.map((n) => `  ${n},`).join("\n")}\n} from "${from}";`;
}

/** `head(params)tail`, with the parameters one per line when it does not fit. */
function signature(indent: string, head: string, params: string[], tail: string): string {
  const flat = `${indent}${head}(${params.join(", ")})${tail}`;
  if (fits(flat) || params.length === 0) return flat;
  return `${indent}${head}(\n${params.map((p) => `${indent}  ${p},`).join("\n")}\n${indent})${tail}`;
}

/** An object literal `{ a: x, b }` at `indent`, broken one property per line when needed. */
function objectLiteral(props: string[], indent: string, before: string, after: string): string {
  const flat = `${before}{ ${props.join(", ")} }${after}`;
  if (fits(indent + flat)) return flat;
  return `${before}{\n${props.map((p) => `${indent}  ${p},`).join("\n")}\n${indent}}${after}`;
}

// ------------------------------------------------------------------------------------ expressions

/** A translated expression: its text and precedence (higher binds tighter). */
interface TExpr {
  text: string;
  prec: number;
  /** For a binary expression: the operator, for prettier's parenthesis rules. */
  op?: string;
  /** For a chain of one logical operator: its operands, for breaking a long condition. */
  chain?: { op: string; parts: TExpr[] };
  /** For `!e`: e (a negated chain breaks like a chain). */
  negated?: TExpr;
}

const PREC: Record<string, number> = {
  "||": 1, "&&": 2, "===": 3, "!==": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6,
};
const ATOM = 10;
const MULT = new Set(["*", "/", "%"]);
const EQUALITY = new Set(["===", "!=="]);

/** Prettier's shouldFlatten: whether `a op1 b op2 c` stays without parentheses. */
function shouldFlatten(parentOp: string, nodeOp: string): boolean {
  if (PREC[parentOp] !== PREC[nodeOp]) return false;
  if (EQUALITY.has(parentOp) && EQUALITY.has(nodeOp)) return false;
  if ((nodeOp === "%" && MULT.has(parentOp)) || (parentOp === "%" && MULT.has(nodeOp))) return false;
  if (nodeOp !== parentOp && MULT.has(nodeOp) && MULT.has(parentOp)) return false;
  return true;
}

/** Prettier's parenthesis rules for a binary operand. */
function needsParens(parentOp: string, node: TExpr, side: "left" | "right"): boolean {
  if (node.op === undefined) return node.prec < PREC[parentOp];
  const pp = PREC[parentOp];
  const np = node.prec;
  if (pp > np) return true;
  if (pp === np && side === "right") return true;
  if (pp === np && !shouldFlatten(parentOp, node.op)) return true;
  if (pp < np && node.op === "%") return parentOp === "+" || parentOp === "-";
  // prettier parenthesizes && inside ||
  if (parentOp === "||" && node.op === "&&") return true;
  return false;
}

function binary(op: string, l: TExpr, r: TExpr): TExpr {
  // && and || are associative, so prettier prints a && (b && c) as a && b && c
  const logical = op === "&&" || op === "||";
  const flatRight = logical && r.op === op;
  const wrap = (e: TExpr, side: "left" | "right") =>
    (side === "right" && flatRight) || !needsParens(op, e, side) ? e.text : `(${e.text})`;
  const text = `${wrap(l, "left")} ${op} ${wrap(r, "right")}`;
  const out: TExpr = { text, prec: PREC[op], op };
  if (logical) {
    const side = (e: TExpr, s: "left" | "right"): TExpr[] =>
      e.chain && e.chain.op === op ? e.chain.parts : [needsParens(op, e, s) ? { ...e, text: `(${e.text})`, prec: ATOM } : e];
    out.chain = { op, parts: [...side(l, "left"), ...(flatRight ? side(r, "left") : side(r, "right"))] };
  }
  return out;
}

const SCALARS = new Set(["Int", "Float", "Bool", "String", "Unit"]);

class ExprWriter {
  readonly runtime = new Set<string>();

  constructor(private readonly info: TypeInfo, private readonly params: Map<string, string>) {}

  private typeOf(e: A.Expr): Type | null {
    const t = this.info.types.get(e);
    return t ? resolve(t) : null;
  }

  private isCon(e: A.Expr, name: string): boolean {
    const t = this.typeOf(e);
    return t !== null && t.t === "con" && t.name === name;
  }

  private scalar(e: A.Expr): boolean {
    const t = this.typeOf(e);
    return t !== null && t.t === "con" && SCALARS.has(t.name);
  }

  expr(e: A.Expr): TExpr {
    switch (e.k) {
      case "Int":
        return { text: e.value, prec: ATOM };
      case "Float":
        return { text: numText(e.value), prec: ATOM };
      case "Str":
        return { text: tsString(strValue(e.raw)), prec: ATOM };
      case "Bool":
        return { text: e.value ? "true" : "false", prec: ATOM };
      case "Name":
        return { text: this.params.get(e.path[0]) ?? camel(e.path[0]), prec: ATOM };
      case "FieldGet":
        return { text: `${this.atom(this.expr(e.obj))}.${e.name}`, prec: ATOM };
      case "ListLit":
        return { text: `[${e.items.map((x) => this.expr(x).text).join(", ")}]`, prec: ATOM };
      case "Unary": {
        const x = this.expr(e.operand);
        // -(-2) stays parenthesized: --2 is a decrement in JavaScript
        const inner = x.prec < 7 || (e.op === "-" && x.text.startsWith("-")) ? `(${x.text})` : x.text;
        return { text: `${e.op === "-" ? "-" : "!"}${inner}`, prec: 7, ...(e.op === "-" ? {} : { negated: x }) };
      }
      case "Binary":
        return this.binaryExpr(e);
      case "Call":
        return this.call(e);
      default:
        throw new Error(`internal: ${e.k} is not portable (A003 should have caught it)`);
    }
  }

  /** References already compared with a literal in this rule (TypeScript narrows them). */
  private readonly narrowed = new Set<string>();

  /**
   * A variable or field compared with a literal a second time is widened (`String(s)`), because
   * TypeScript narrows it after the first comparison and then rejects the second (TS2367).
   */
  private widen(side: A.Expr, other: A.Expr, x: TExpr): TExpr {
    const isRef = side.k === "Name" || side.k === "FieldGet";
    const isLit = other.k === "Str" || other.k === "Int" || other.k === "Float" || other.k === "Bool" ||
      (other.k === "Unary" && other.operand.k !== "Name" && other.operand.k !== "FieldGet");
    if (!isRef || !isLit) return x;
    if (!this.narrowed.has(x.text)) {
      this.narrowed.add(x.text);
      return x;
    }
    const wrap = this.isCon(side, "String") ? "String" : this.isCon(side, "Bool") ? "Boolean" : "Number";
    return { text: `${wrap}(${x.text})`, prec: ATOM };
  }

  private atom(x: TExpr): string {
    return x.prec < ATOM ? `(${x.text})` : x.text;
  }

  private binaryExpr(e: A.Binary): TExpr {
    const l = this.expr(e.left);
    const r = this.expr(e.right);
    const op = e.op === "and" ? "&&" : e.op === "or" ? "||" : e.op;
    if (op === "==" || op === "!=") {
      if (this.scalar(e.left) && this.scalar(e.right)) {
        return binary(op === "==" ? "===" : "!==", this.widen(e.left, e.right, l), this.widen(e.right, e.left, r));
      }
      this.runtime.add("eq");
      const call: TExpr = { text: `eq(${l.text}, ${r.text})`, prec: ATOM };
      return op === "==" ? call : { text: `!${call.text}`, prec: 7 };
    }
    if (op === "/" && this.isCon(e.left, "Int")) {
      this.runtime.add("div");
      return { text: `div(${l.text}, ${r.text})`, prec: ATOM };
    }
    if (["<", "<=", ">", ">="].includes(op) && this.isCon(e.left, "String")) {
      // strings compare by code point, as in Canon and Python (JavaScript's < uses UTF-16 units)
      this.runtime.add("compareStrings");
      return binary(op, { text: `compareStrings(${l.text}, ${r.text})`, prec: ATOM }, { text: "0", prec: ATOM });
    }
    return binary(op, l, r);
  }

  private call(e: A.Call): TExpr {
    const name = e.callee.k === "Name" ? e.callee.path[0] : e.callee.name;
    const args = e.args.map((a) => this.expr(a));
    switch (name) {
      case "str_len":
        this.runtime.add("strLen");
        return { text: `strLen(${args[0].text})`, prec: ATOM };
      case "trim":
        this.runtime.add("trim");
        return { text: `trim(${args[0].text})`, prec: ATOM };
      case "contains":
        this.runtime.add("contains");
        return { text: `contains(${args[0].text}, ${args[1].text})`, prec: ATOM };
      case "is_email":
        this.runtime.add("isEmail");
        return { text: `isEmail(${args[0].text})`, prec: ATOM };
      case "len":
        return { text: `${this.atom(args[0])}.length`, prec: ATOM };
      case "is_some":
        return binary("!==", args[0], { text: "null", prec: ATOM });
      default:
        throw new Error(`internal: ${name} is not portable (A003 should have caught it)`);
    }
  }
}

/** `!(cond)`, or `!cond` for an atom (prettier drops the parentheses then). */
function negate(c: TExpr): string {
  return c.prec >= 7 ? `!${c.text}` : `!(${c.text})`;
}

/** `if (!(cond)) {` at `indent`, broken one operand per line as prettier does when too long. */
function ifNot(c: TExpr, indent: string): string {
  if (c.negated) {
    // a rule that is itself a negation, `!(x)`: the validator tests `x` (no double negation)
    const x = c.negated;
    const flatPositive = `${indent}if (${x.text}) {`;
    if (fits(flatPositive) || !x.chain || x.prec >= 7) return flatPositive;
    // an if's test breaks one operand per line (prettier never groups a chain there)
    const { op, parts } = x.chain;
    const lines = parts.flatMap((p, i) => operandLines(p, `${indent}  `, "", i < parts.length - 1 ? ` ${op}` : ""));
    return `${indent}if (\n${lines.join("\n")}\n${indent}) {`;
  }
  const flat = `${indent}if (${negate(c)}) {`;
  if (fits(flat)) return flat;
  const inner = c;
  if (!inner.chain || inner.prec >= 7) return flat;
  // prettier breaks the parentheses first. It groups only the right side of a two-operand
  // chain whose operands are not themselves && or || expressions, so `a && b` stays on one line
  // when it fits; every other chain puts one operand per line.
  const one = `${indent}  ${inner.text}`;
  const simple = inner.chain.parts.every((p) => p.op !== "&&" && p.op !== "||");
  if (inner.chain.parts.length === 2 && simple && fits(one)) return `${indent}if (!(\n${one}\n${indent})) {`;
  const { op, parts } = inner.chain;
  const lines = parts.flatMap((p, i) => operandLines(p, `${indent}  `, "", i < parts.length - 1 ? ` ${op}` : ""));
  return `${indent}if (!(\n${lines.join("\n")}\n${indent})) {`;
}

/**
 * One operand of a broken chain: on one line if it fits, otherwise (for a parenthesized chain)
 * broken inside its parentheses as prettier does, continuation lines indented two more.
 */
function operandLines(e: TExpr, indent: string, prefix: string, suffix: string): string[] {
  const flat = `${indent}${prefix}${e.text}${suffix}`;
  if (fits(flat) || !e.chain || !e.text.startsWith("(")) return [flat];
  const { op, parts } = e.chain;
  return parts.flatMap((p, i) =>
    operandLines(
      p,
      i === 0 ? indent : `${indent}  `,
      i === 0 ? `${prefix}(` : "",
      i < parts.length - 1 ? ` ${op}` : `)${suffix}`,
    ));
}

// ------------------------------------------------------------------------------------ files

function typesFile(decls: Decls, used: Set<string>): string {
  const out: string[] = [];
  for (const name of decls.order) {
    if (!used.has(name)) continue;
    const r = decls.records.get(name);
    if (r) {
      if (r.fields.length === 0) {
        out.push(`export type ${name} = Record<string, never>;`);
      } else {
        out.push(`export interface ${name} {\n${r.fields.map(([f, t]) => `  ${f}: ${tsType(t)};`).join("\n")}\n}`);
      }
      continue;
    }
    const s = decls.sums.get(name)!;
    const variants = s.variants.map(([vn, fs]) => objectType([["kind", `"${vn}"`], ...fs.map(([f, t]) => [f, tsType(t)] as [string, string])]));
    const flat = `export type ${name} = ${variants.join(" | ")};`;
    if (fits(flat)) {
      out.push(flat);
      continue;
    }
    const lines = s.variants.map(([vn, fs], i) => {
      const one = `  | ${variants[i]}`;
      if (fits(one)) return one;
      const fields = [["kind", `"${vn}"`], ...fs.map(([f, t]) => [f, tsType(t)])];
      return `  | {\n${fields.map(([f, t]) => `      ${f}: ${t};`).join("\n")}\n    }`;
    });
    out.push(`export type ${name} =\n${lines.join("\n")};`);
  }
  return out.length ? out.join("\n\n") + "\n" : "export {};\n";
}

interface Method {
  ep: Endpoint;
  /** Parameter names in TypeScript, by Canon name. */
  names: Map<string, string>;
  validator: string | null;
  /** Canon names of the parameters the validator takes, in parameter order. */
  validatorParams: string[];
  condition: TExpr | null;
  errors: string[];
  ret: string;
}

function methods(endpoints: Endpoint[], runtime: Set<string>): Method[] {
  return endpoints.map((ep) => {
    const { fn } = ep;
    const names = new Map(fn.params.map(([p]) => [p, paramName(p)]));
    let condition: TExpr | null = null;
    let validatorParams: string[] = [];
    if (fn.requires) {
      const w = new ExprWriter(ep.info, names);
      condition = w.expr(fn.requires);
      for (const r of w.runtime) runtime.add(r);
      const used = new Set<string>();
      const visit = (x: unknown) => {
        if (!x || typeof x !== "object") return;
        if (Array.isArray(x)) return x.forEach(visit);
        const n = x as A.Expr;
        if (n.k === "Name" && names.has(n.path[0])) used.add(n.path[0]);
        for (const v of Object.values(x)) visit(v);
      };
      visit(fn.requires);
      validatorParams = fn.params.map(([p]) => p).filter((p) => used.has(p));
    }
    const isResult = fn.ret.k === "TName" && fn.ret.name === "Result" && fn.ret.args.length === 2;
    const ok = isResult ? (fn.ret as Extract<A.TypeExpr, { k: "TName" }>).args[0] : fn.ret;
    const errors = [
      ...(isResult ? [tsType((fn.ret as Extract<A.TypeExpr, { k: "TName" }>).args[1])] : []),
      ...(fn.requires ? ["ValidationError"] : []),
      "TransportError",
    ];
    return {
      ep, names, condition, validatorParams, errors, ret: tsType(ok),
      validator: fn.requires ? `validate${pascal(fn.name)}` : null,
    };
  });
}

function typeNamesIn(t: string, known: Set<string>): string[] {
  return (t.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []).filter((n) => known.has(n));
}

function validateFile(ms: Method[], known: Set<string>): string {
  const withRules = ms.filter((m) => m.validator);
  if (!withRules.length) return "export {};\n";
  const runtime = new Set<string>(["type ValidationError"]);
  const types: string[] = [];
  const fns: string[] = [];
  for (const m of withRules) {
    const { fn } = m.ep;
    const w = new ExprWriter(m.ep.info, m.names);
    const cond = w.expr(fn.requires!);
    for (const r of w.runtime) runtime.add(r);
    const params = m.validatorParams.map((p) => {
      const t = tsType(fn.params.find(([n]) => n === p)![1]);
      types.push(...typeNamesIn(t, known));
      return `${m.names.get(p)}: ${t}`;
    });
    const sig = signature("", `export function ${m.validator}`, params, ": ValidationError | null {");
    const rule = tsString(ruleText(fn.requires!));
    const ret = objectLiteral(['kind: "ValidationError"', `rule: ${rule}`], "    ", "    return ", ";");
    fns.push(`${sig}\n${ifNot(cond, "  ")}\n${ret}\n  }\n  return null;\n}`);
  }
  const imports = [importLine([...runtime], "./runtime")];
  if (types.length) imports.push(importLine(types, "./types", true));
  return `${imports.join("\n")}\n\n${fns.join("\n\n")}\n`;
}

function pathExpr(fn: A.Fn, names: Map<string, string>): string {
  const route = fn.route!;
  const ps = routeParams(route.path);
  if (!Array.isArray(ps) || ps.length === 0) return JSON.stringify(route.path);
  const types = new Map(fn.params);
  const text = route.path.replace(/\{([a-z_][a-z0-9_]*)\}/g, (_m, p: string) => {
    const t = types.get(p)!;
    const n = names.get(p)!;
    return t.k === "TName" && t.name === "String" ? `\${encodeURIComponent(${n})}` : `\${${n}}`;
  });
  return "`" + text + "`";
}

function clientFile(ms: Method[], known: Set<string>): string {
  const runtime = new Set<string>(["request", "type Result", "type TransportError"]);
  const types: string[] = [];
  const validators: string[] = [];
  const bodies: string[] = [];
  for (const m of ms) {
    const { fn } = m.ep;
    if (m.validator) {
      validators.push(m.validator);
      runtime.add("type ValidationError");
    }
    const params = fn.params.map(([p, t]) => {
      const tt = tsType(t);
      types.push(...typeNamesIn(tt, known));
      return `${m.names.get(p)}: ${tt}`;
    });
    for (const e of m.errors) types.push(...typeNamesIn(e, known));
    types.push(...typeNamesIn(m.ret, known));
    const head = `async ${camel(fn.name)}`;
    const tail = `: Promise<Result<${m.ret}, ${m.errors.join(" | ")}>> {`;
    const lines = [signature("    ", head, params, tail)];
    if (m.validator) {
      lines.push(`      const invalid = ${m.validator}(${m.validatorParams.map((p) => m.names.get(p)).join(", ")});`);
      lines.push("      if (invalid) return { ok: false, error: invalid };");
    }
    const pathParams = routeParams(fn.route!.path) as string[];
    const rest = fn.params.filter(([p]) => !pathParams.includes(p));
    const method = fn.route!.method;
    const args = ["baseUrl", `"${method}"`, pathExpr(fn, m.names)];
    let options: string[] | null = null;
    if (rest.length && (method === "GET" || method === "DELETE")) {
      const q = rest.map(([p]) => (m.names.get(p) === p ? p : `${p}: ${m.names.get(p)}`));
      options = [`query: { ${q.join(", ")} }`];
      const flatQuery = `      return request(${args.join(", ")}, { ${options[0]} });`;
      if (!fits(flatQuery)) {
        // the query object itself breaks inside the hugged options object
        const inner = `query: { ${q.join(", ")} },`;
        options = fits(`        ${inner}`) ? [options[0]] : [`query: {\n${q.map((x) => `          ${x},`).join("\n")}\n        }`];
      }
    } else if (rest.length) {
      options = [`body: ${m.names.get(rest[0][0])}`];
    }
    lines.push(requestCall(args, options));
    bodies.push(`${lines.join("\n")}\n    },`);
  }
  const imports = [importLine([...runtime], "./runtime")];
  if (types.length) imports.push(importLine(types, "./types", true));
  if (validators.length) imports.push(importLine(validators, "./validate"));
  const body = bodies.length ? `  return {\n${bodies.join("\n\n")}\n  };` : "  return {};";
  return `${imports.join("\n")}\n\nexport function createClient(baseUrl: string) {\n${body}\n}\n`;
}

/** `return request(...)`, hugging the options object as prettier does when it does not fit. */
function requestCall(args: string[], options: string[] | null): string {
  const indent = "      ";
  const opt = options ? `{ ${options.join(", ")} }` : null;
  const flat = `${indent}return request(${[...args, ...(opt ? [opt] : [])].join(", ")});`;
  if (fits(flat) && !(opt && opt.includes("\n"))) return flat;
  if (opt) {
    const head = `${indent}return request(${args.join(", ")}, {`;
    if (fits(head)) return `${head}\n${options!.map((o) => `${indent}  ${o},`).join("\n")}\n${indent}});`;
  }
  const all = [...args, ...(opt ? [opt] : [])];
  return `${indent}return request(\n${all.map((a) => `${indent}  ${a},`).join("\n")}\n${indent});`;
}

/** The fixed runtime every generated client imports. */
export const TS_RUNTIME = `export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ValidationError {
  kind: "ValidationError";
  rule: string;
}

/** A network failure, a response that is not JSON, or a status the endpoint does not define. */
export interface TransportError {
  kind: "TransportError";
  status: number | null;
  message: string;
}

type Query = Record<string, string | number | boolean | null>;

/** Call an endpoint. Never throws: every failure is an error Result. */
export async function request<T, E>(
  baseUrl: string,
  method: string,
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<Result<T, E>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  let response: Response;
  try {
    response = await fetch(baseUrl + path + (qs ? \`?\${qs}\` : ""), {
      method,
      headers: options.body === undefined ? {} : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (e) {
    return fail(null, e instanceof Error ? e.message : String(e));
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fail(response.status, "the response is not JSON");
  }
  if (response.ok) return { ok: true, value: payload as T };
  const error = (payload as { error?: unknown } | null)?.error;
  const typed = typeof error === "object" && error !== null && "kind" in error;
  if ((response.status === 400 || response.status === 422) && typed) {
    return { ok: false, error: error as E };
  }
  return fail(response.status, \`HTTP \${response.status}\`);
}

function fail<T, E>(status: number | null, message: string): Result<T, E> {
  const error: TransportError = { kind: "TransportError", status, message };
  return { ok: false, error: error as E };
}

/** Whitespace trim() removes: JavaScript's String.prototype.trim set, shared with the Python runtime. */
export const WHITESPACE =
  ${JSON.stringify(TRIM_WHITESPACE).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))};

export function trim(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && WHITESPACE.includes(s[start])) start++;
  while (end > start && WHITESPACE.includes(s[end - 1])) end--;
  return s.slice(start, end);
}

/** The number of code points, as Canon's str_len and Python's len count. */
export function strLen(s: string): number {
  return Array.from(s).length;
}

/** Strings ordered by code point, as Canon and Python order them. */
export function compareStrings(a: string, b: string): number {
  const x = Array.from(a, (c) => c.codePointAt(0)!);
  const y = Array.from(b, (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

// eslint-disable-next-line no-control-regex -- vertical tab and form feed are spelled out on purpose
const EMAIL = /^[^@ \\t\\n\\r\\x0b\\x0c]+@[^@ \\t\\n\\r\\x0b\\x0c]+\\.[^@ \\t\\n\\r\\x0b\\x0c]+$/;

export function isEmail(s: string): boolean {
  return EMAIL.test(s);
}

/** Integer division truncating toward zero, as Canon's / on Int. */
export function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Structural equality on wire values. */
export function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function contains<T>(xs: T[], x: T): boolean {
  return xs.some((y) => eq(x, y));
}
`;

/** The frontend files for a checked project, paths relative to the frontend output folder. */
export function generateTsClient(project: ProjectResult): GeneratedFile[] {
  if (!project.ok) throw new Error("generateTsClient needs a project that checks");
  const { endpoints, decls } = collect(project);
  const used = reachable(endpoints, decls);
  const runtime = new Set<string>();
  const ms = methods(endpoints, runtime);
  const from = sourceOf(project);
  return [
    { path: "types.ts", text: finishGenerated(typesFile(decls, used), "//", from) },
    { path: "validate.ts", text: finishGenerated(validateFile(ms, used), "//", from) },
    { path: "client.ts", text: finishGenerated(clientFile(ms, used), "//", from) },
    { path: "runtime.ts", text: finishGenerated(TS_RUNTIME, "//", null) },
  ];
}
