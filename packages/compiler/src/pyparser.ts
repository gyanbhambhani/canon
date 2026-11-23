/**
 * v0.4 parser for the Python-shaped surface, Canon-Py (docs/v0.4-design.md). It produces the same
 * AST as the brace parser, so the checker, code generator and runtime are shared. Python forms
 * with no Canon meaning are rejected with a message that names the Canon form.
 */
import type * as A from "./ast.js";
import { CanonError, diag } from "./diagnostics.js";
import { PY_REJECTED_STATEMENTS, pyLex, type PyTok, type PyTokKind } from "./pylexer.js";
import { pyRepr } from "./py.js";

const CMP = new Set(["==", "!=", "<", "<=", ">", ">="]);
const AUG: Record<string, string> = { "+=": "+", "-=": "-", "*=": "*", "/=": "/", "%=": "%" };
/** Canon-Py type names for Canon's built-in types. */
export const PY_TYPE_NAMES: Record<string, string> = {
  int: "Int", float: "Float", bool: "Bool", str: "String", list: "List", dict: "Map",
};

/** Assignments written with a plain `=` (the binding pass may turn them into new bindings). */
const PLAIN = new WeakSet<A.SetStmt>();

const intText = (t: string) => t.replace(/^0+(?=\d)/, "");

function strip(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(strip);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (k !== "line" && k !== "col") o[k] = strip(v);
    return o;
  }
  return x;
}

/** Structural equality, ignoring positions. */
export function sameNode(a: unknown, b: unknown): boolean {
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const boolPat = (value: boolean, p: A.Pos): A.Pattern => ({
  k: "PLit", lit: { k: "Bool", value, line: p.line, col: p.col }, line: p.line, col: p.col,
});

/** A test's Canon name from its identifier: `test_adds_two` is the test "adds two". */
export function testNameFromIdent(ident: string): string {
  return `"${ident.slice(5).replace(/_/g, " ")}"`;
}

/** Re-quote an f-string literal part written in single quotes. */
function requote(body: string, q: string): string {
  if (q === '"') return body;
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length) {
      out += body[i + 1] === "'" ? "'" : c + body[i + 1];
      i++;
    } else out += c === '"' ? '\\"' : c;
  }
  return out;
}

export class PyParser {
  private i = 0;

  constructor(private readonly toks: PyTok[]) {}

  private get tok(): PyTok {
    return this.toks[this.i];
  }

  private peek(k = 1): PyTok {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)];
  }

  private at(kind: PyTokKind, text?: string): boolean {
    const t = this.tok;
    return t.kind === kind && (text === undefined || t.text === text);
  }

  private atOp(text: string) {
    return this.at("op", text);
  }

  private atKw(text: string) {
    return this.at("kw", text);
  }

  private advance(): PyTok {
    return this.toks[this.i++];
  }

  private fail(message: string, t: PyTok = this.tok, code = "P001"): never {
    throw new CanonError(diag(code, message, t.line, t.col));
  }

  private describe(t: PyTok): string {
    switch (t.kind) {
      case "eof":
        return "end of file";
      case "newline":
        return "end of line";
      case "indent":
        return "an indented block";
      case "dedent":
        return "the end of a block";
      default:
        return pyRepr(t.text);
    }
  }

  private error(expected: string): never {
    if (this.at("comment")) this.fail("comments must sit on their own line between statements", this.tok, "P002");
    return this.fail(`expected ${expected}, found ${this.describe(this.tok)}`);
  }

  private expect(kind: PyTokKind, text?: string, what?: string): PyTok {
    if (!this.at(kind, text)) this.error(what ?? (text !== undefined ? pyRepr(text) : kind));
    return this.advance();
  }

  private eatOp(text: string): boolean {
    if (this.atOp(text)) {
      this.advance();
      return true;
    }
    return false;
  }

  private pos(t: PyTok): A.Pos {
    return { line: t.line, col: t.col };
  }

  private endLine() {
    if (this.at("newline")) {
      this.advance();
      return;
    }
    if (this.at("eof")) return;
    this.error("end of line");
  }

  // ---------------------------------------------------------------------------------- items

  program(): A.Program {
    const items: A.Item[] = [];
    while (this.at("newline")) this.advance();
    while (!this.at("eof")) {
      if (this.at("indent")) this.fail("unexpected indentation at top level");
      items.push(this.item());
      while (this.at("newline")) this.advance();
    }
    return { k: "Program", items };
  }

  private item(): A.Item {
    const t = this.tok;
    if (t.kind === "comment") {
      this.advance();
      this.endLine();
      return { k: "Comment", text: t.text, ...this.pos(t) };
    }
    if (this.atKw("import")) {
      this.advance();
      const path = [this.expect("name", undefined, "module name").text];
      while (this.eatOp(".")) path.push(this.expect("name", undefined, "module name").text);
      this.endLine();
      return { k: "Use", path, ...this.pos(t) };
    }
    if (this.at("name", "from")) this.fail("write `import std.name`; `from` imports do not exist in Canon");
    if (this.atKw("type")) return this.typeDecl();
    if (this.atOp("@") || this.atKw("def") || this.atKw("class")) return this.decorated();
    return this.error("'def', 'class', 'type' or 'import' at top level");
  }

  private decorated(): A.Item {
    const effects: string[] = [];
    let requires: A.Expr | null = null;
    let ensures: A.Expr | null = null;
    let sawEffects = false;
    let contract: PyTok | null = null;
    while (this.atOp("@")) {
      this.advance();
      const d = this.expect("name", undefined, "decorator name (effects, requires or ensures)");
      if (d.text === "dataclass") {
        // accepted for familiarity; records need no decorator, and fmt removes it
        this.endLine();
        continue;
      }
      if (d.text === "effects") {
        sawEffects = true;
        this.expect("op", "(");
        while (!this.atOp(")")) {
          effects.push(this.expect("name", undefined, "effect name").text);
          if (!this.eatOp(",")) break;
        }
        this.expect("op", ")");
      } else if (d.text === "requires" || d.text === "ensures") {
        contract ??= d;
        this.expect("op", "(");
        const e = this.expr();
        this.expect("op", ")");
        const and = (l: A.Expr | null): A.Expr => (l === null ? e : { k: "Binary", op: "and", left: l, right: e, line: 0, col: 0 });
        if (d.text === "requires") requires = and(requires);
        else ensures = and(ensures);
      } else {
        this.fail(`unknown decorator @${d.text}; Canon's decorators are @effects, @requires and @ensures`, d);
      }
      this.endLine();
    }
    if (this.atKw("class")) {
      if (sawEffects || contract) this.fail("@effects, @requires and @ensures apply to functions, not records");
      return this.classDecl();
    }
    if (!this.atKw("def")) this.error("'def' after decorators");
    return this.fnDecl(effects, requires, ensures, contract);
  }

  private tparams(): string[] {
    const ps: string[] = [];
    if (this.eatOp("[")) {
      ps.push(this.expect("tname", undefined, "type parameter").text);
      while (this.eatOp(",")) {
        if (this.atOp("]")) break;
        ps.push(this.expect("tname", undefined, "type parameter").text);
      }
      this.expect("op", "]");
    }
    return ps;
  }

  private classDecl(): A.RecordType {
    const t = this.advance();
    const name = this.expect("tname", undefined, "record name (PascalCase)").text;
    const params = this.tparams();
    if (this.atOp("(")) this.fail("records do not inherit; write `class Name:` with typed fields");
    this.expect("op", ":");
    this.expect("newline", undefined, "end of line after `class Name:`");
    this.expect("indent", undefined, "an indented block of fields");
    const fields: [string, A.TypeExpr][] = [];
    while (!this.at("dedent") && !this.at("eof")) {
      if (this.at("comment")) this.fail("comments cannot sit inside a record; put them above the class", this.tok, "P002");
      if (this.atKw("pass")) {
        this.advance();
        this.endLine();
        continue;
      }
      if (this.atKw("def")) this.fail("records hold fields only; Canon has no methods: write a function after the class");
      const f = this.expect("name", undefined, "field name");
      if (!this.atOp(":")) this.fail(`field ${f.text} needs a type: \`${f.text}: int\``);
      this.advance();
      fields.push([f.text, this.typeExpr()]);
      if (this.atOp("=")) this.fail("record fields have no default values");
      this.endLine();
    }
    if (this.at("dedent")) this.advance();
    return { k: "RecordType", name, params, fields, ...this.pos(t) };
  }

  private typeDecl(): A.SumType {
    const t = this.advance();
    const name = this.expect("tname", undefined, "type name").text;
    const params = this.tparams();
    this.expect("op", "=", "'=' (a sum type is `type Name = Variant(field: type) | Other`)");
    const paren = this.eatOp("(");
    this.eatOp("|");
    const variants = [this.variant()];
    while (this.eatOp("|")) variants.push(this.variant());
    if (paren) this.expect("op", ")");
    this.endLine();
    return { k: "SumType", name, params, variants, ...this.pos(t) };
  }

  private variant(): A.Variant {
    const name = this.expect("tname", undefined, "variant name (PascalCase)").text;
    const fields: [string, A.TypeExpr][] = [];
    if (this.eatOp("(")) {
      while (!this.atOp(")")) {
        const f = this.expect("name", undefined, "field name").text;
        this.expect("op", ":");
        fields.push([f, this.typeExpr()]);
        if (!this.eatOp(",")) break;
      }
      this.expect("op", ")");
    }
    return [name, fields];
  }

  typeExpr(): A.TypeExpr {
    const t = this.tok;
    const p = this.pos(t);
    let ty: A.TypeExpr;
    if (t.kind === "tname" && t.text === "Callable") {
      this.advance();
      this.expect("op", "[");
      this.expect("op", "[", "'[' and the parameter types (Callable[[A, B], R])");
      const params: A.TypeExpr[] = [];
      while (!this.atOp("]")) {
        params.push(this.typeExpr());
        if (!this.eatOp(",")) break;
      }
      this.expect("op", "]");
      this.expect("op", ",");
      const ret = this.typeExpr();
      const effects: string[] = [];
      if (this.eatOp(",")) {
        // v0.4: Callable[[A], B, io | net]
        effects.push(this.expect("name", undefined, "effect name").text);
        while (this.eatOp("|")) effects.push(this.expect("name", undefined, "effect name").text);
      }
      this.expect("op", "]");
      ty = { k: "TFn", params, ret, ...(effects.length ? { effects } : {}), ...p };
    } else if (t.kind === "tname" && t.text === "None") {
      this.advance();
      ty = { k: "TName", name: "Unit", args: [], ...p };
    } else if (t.kind === "tname" && t.text === "Optional") {
      this.fail("Canon's optional type is Option[T], whose values are Some(x) and None");
    } else if (t.kind === "name" && t.text === "tuple") {
      this.advance();
      this.expect("op", "[");
      const items = [this.typeExpr()];
      while (this.eatOp(",")) {
        if (this.atOp("]")) break;
        items.push(this.typeExpr());
      }
      this.expect("op", "]");
      ty = items.length === 1 ? items[0] : { k: "TTuple", items, ...p };
    } else if (t.kind === "name") {
      const mapped = PY_TYPE_NAMES[t.text];
      if (mapped === undefined) {
        this.fail(`unknown type ${t.text}; the built-in types are int, float, bool, str, None, list[T], dict[K, V], tuple[A, B], Option[T], Result[T, E] and Callable[[A], B]`);
      }
      this.advance();
      ty = { k: "TName", name: mapped, args: this.typeArgs(), ...p };
    } else if (t.kind === "tname") {
      this.advance();
      ty = { k: "TName", name: t.text, args: this.typeArgs(), ...p };
    } else if (this.atOp("(")) {
      this.advance();
      const items = [this.typeExpr()];
      while (this.eatOp(",")) {
        if (this.atOp(")")) break;
        items.push(this.typeExpr());
      }
      this.expect("op", ")");
      ty = items.length === 1 ? items[0] : { k: "TTuple", items, ...p };
    } else {
      return this.error("a type");
    }
    if (this.atOp("|")) this.fail("type unions do not exist in Canon; for an optional value use Option[T], and for alternatives declare `type Name = A(...) | B(...)`");
    return ty;
  }

  private typeArgs(): A.TypeExpr[] {
    const args: A.TypeExpr[] = [];
    if (this.eatOp("[")) {
      args.push(this.typeExpr());
      while (this.eatOp(",")) {
        if (this.atOp("]")) break;
        args.push(this.typeExpr());
      }
      this.expect("op", "]");
    }
    return args;
  }

  private fnDecl(effects: string[], requires: A.Expr | null, ensures: A.Expr | null, contract: PyTok | null): A.Fn | A.Test {
    const defTok = this.advance();
    const nameTok = this.expect("name", undefined, "function name");
    const tparams = this.tparams();
    this.expect("op", "(");
    const params: [string, A.TypeExpr][] = [];
    while (!this.atOp(")")) {
      if (this.atOp("*")) this.fail("*args and **kwargs do not exist in Canon");
      const pn = this.expect("name", undefined, "parameter name");
      if (!this.atOp(":")) this.fail(`parameter ${pn.text} needs a type: every signature is fully typed (\`${pn.text}: int\`)`, this.tok, "P003");
      this.advance();
      params.push([pn.text, this.typeExpr()]);
      if (this.atOp("=")) this.fail("default arguments do not exist in Canon; pass every argument");
      if (!this.eatOp(",")) break;
    }
    this.expect("op", ")");
    if (!this.atOp("->")) this.error("'->' and a return type (return types are required; write -> None for no value)");
    this.advance();
    const ret = this.typeExpr();
    const isTest = nameTok.text.startsWith("test_") && params.length === 0 && tparams.length === 0;
    const body = this.block();
    if (isTest) {
      if (contract) this.fail("a test takes no @requires or @ensures", contract);
      if (!(ret.k === "TName" && ret.name === "Unit")) this.fail("a test function returns None: `def test_name() -> None:`", nameTok);
      return { k: "Test", name: testNameFromIdent(nameTok.text), effects, body: resolveBindings([], body), ...this.pos(defTok) };
    }
    return {
      k: "Fn", name: nameTok.text, tparams, params, ret, effects, requires, ensures,
      body: resolveBindings(params.map(([n]) => n), body, this.pos(nameTok)), ...this.pos(nameTok),
    };
  }

  // ----------------------------------------------------------------------------- statements

  /** `:` and an indented block, or one simple statement on the same line. */
  private block(): A.Stmt[] {
    this.expect("op", ":");
    if (!this.at("newline")) {
      if (this.atKw("if") || this.atKw("for") || this.atKw("while") || this.atKw("match")) {
        this.fail("a compound statement starts on its own line");
      }
      const s = this.simpleStmt();
      return s ? [s] : [];
    }
    this.advance();
    if (!this.at("indent")) this.error("an indented block");
    this.advance();
    const stmts: A.Stmt[] = [];
    while (!this.at("dedent") && !this.at("eof")) {
      const s = this.stmt();
      if (s) stmts.push(s);
    }
    if (this.at("dedent")) this.advance();
    return stmts;
  }

  private stmt(): A.Stmt | null {
    const t = this.tok;
    if (t.kind === "comment") {
      this.advance();
      this.endLine();
      return { k: "Comment", text: t.text, ...this.pos(t) };
    }
    if (t.kind === "indent") this.fail("unexpected indentation");
    if (this.atKw("if")) return this.ifStmt();
    if (this.atKw("while")) {
      this.advance();
      const cond = this.expr();
      return { k: "ForWhile", cond, body: this.block(), ...this.pos(t) };
    }
    if (this.atKw("for")) return this.forStmt();
    if (this.atKw("match")) return this.matchStmt();
    if (this.atKw("def")) this.fail("functions are declared at top level only; a lambda is one expression");
    if (this.atKw("class") || this.atKw("type")) this.fail("types are declared at top level only");
    return this.simpleStmt();
  }

  private simpleStmt(): A.Stmt | null {
    const t = this.tok;
    const p = this.pos(t);
    if (this.atKw("pass")) {
      this.advance();
      this.endLine();
      return null;
    }
    if (this.atKw("return")) {
      this.advance();
      if (this.at("newline") || this.at("eof") || this.at("dedent")) {
        this.endLine();
        return { k: "Return", value: null, ...p };
      }
      const value = this.expr();
      this.endLine();
      return { k: "Return", value, ...p };
    }
    if (this.atKw("break")) {
      this.advance();
      this.endLine();
      return { k: "Break", ...p };
    }
    // a Python statement keyword Canon lacks, used as a statement (not as a name being assigned or called)
    const next = this.peek();
    const asStatement = t.kind === "name" && PY_REJECTED_STATEMENTS.has(t.text) &&
      !(next.kind === "op" && ["=", "+=", "-=", "*=", "/=", "%=", "(", ".", "["].includes(next.text));
    if (asStatement && t.text === "continue") this.fail("Canon has no continue; put the rest of the loop body under `if not cond:`");
    if (asStatement && ["raise", "except", "finally"].includes(t.text)) {
      this.fail("Canon has no exceptions: return a Result (Ok(value) or Err(error)), and write e? to pass an Err up");
    }
    if (asStatement) this.fail(`'${t.text}' does not exist in Canon`);
    if (this.atKw("assert")) {
      this.advance();
      const cond = this.expr();
      if (this.atOp(",")) this.fail("assert takes no message in Canon");
      this.endLine();
      return { k: "ExprStmt", expr: { k: "Call", callee: { k: "Name", path: ["assert"], ...p }, args: [cond], ...p }, ...p };
    }
    if (this.atKw("try")) {
      this.fail("Canon has no exceptions: return a Result (Ok(value) or Err(error)), and write e? to pass an Err up");
    }
    if (this.atKw("import")) this.fail("imports sit at top level");
    const e = this.expr();
    if (this.atOp(":") && e.k === "Name") this.fail("local bindings never carry type annotations; types live on signatures", this.tok, "P003");
    if (this.atOp(",")) this.fail("Canon binds one name per statement; for a tuple, bind it and use t[0] and t[1]");
    if (this.atOp("=") || this.tok.text in AUG) {
      const op = this.advance().text;
      if (!(e.k === "Name" && e.path.length === 1) && !(e.k === "FieldGet" && !/^\d/.test(e.name))) {
        this.fail("only a name or a record field can be assigned", t);
      }
      const value = this.expr();
      this.endLine();
      if (op === "=") {
        const s: A.SetStmt = { k: "Set", target: e, value, ...p };
        PLAIN.add(s);
        return s;
      }
      return { k: "Set", target: e, value: { k: "Binary", op: AUG[op], left: clone(e), right: value, line: 0, col: 0 }, ...p };
    }
    if (this.atOp("//=") || this.atOp("**=")) this.fail(this.atOp("//=") ? "Canon has no //=; / on two ints truncates toward zero" : "Canon has no **=; use pow(a, b)");
    const inner = e.k === "Try" ? e.expr : e;
    if (inner.k !== "Call") {
      this.fail("an expression statement must be a function call; bind other values to a name (x = ...)", t, "P004");
    }
    this.endLine();
    return { k: "ExprStmt", expr: e, ...p };
  }

  private ifStmt(): A.If {
    const t = this.advance();
    const cond = this.expr();
    const body = this.block();
    let orelse: A.Stmt[] | null = null;
    if (this.atKw("elif")) orelse = [this.ifStmt()];
    else if (this.atKw("else")) {
      this.advance();
      orelse = this.block();
    }
    return { k: "If", cond, body, orelse, ...this.pos(t) };
  }

  private forStmt(): A.ForIn {
    const t = this.advance();
    const paren = this.eatOp("(");
    const names = [this.expect("name", undefined, "loop variable").text];
    while (this.eatOp(",")) {
      if (this.atOp(")") || this.atKw("in")) break;
      names.push(this.expect("name", undefined, "loop variable").text);
    }
    if (paren) this.expect("op", ")");
    this.expect("kw", "in", "'in' (Canon's only for loop is `for x in xs:`)");
    const iterable = this.expr();
    const body = this.block();
    if (names.length >= 2) return { k: "ForIn", var: "", names, iterable, body, ...this.pos(t) };
    return { k: "ForIn", var: names[0], iterable, body, ...this.pos(t) };
  }

  /**
   * Python's match statement. Canon's match is an expression, so every case body is exactly one
   * statement, and all cases end the same way: all `return e`, all `x = e` to the same target, or
   * all calls. A case body may itself be such a match (nested).
   */
  private matchStmt(): A.Stmt {
    const mt = this.advance();
    let subject = this.expr();
    if (this.atOp(",")) {
      const items = [subject];
      while (this.eatOp(",")) items.push(this.expr());
      subject = { k: "TupleLit", items, ...this.pos(mt) };
    }
    this.expect("op", ":");
    this.expect("newline", undefined, "end of line after `match x:`");
    this.expect("indent", undefined, "indented `case` lines");
    type Arm = { kind: "return" | "assign" | "call"; target?: A.Expr; plain?: boolean; value: A.Expr; tok: PyTok };
    const arms: [A.Pattern, Arm][] = [];
    while (!this.at("dedent") && !this.at("eof")) {
      if (this.at("comment")) this.fail("comments cannot sit between cases; put them above the match", this.tok, "P002");
      const ct = this.expect("kw", "case", "'case'");
      let pat = this.pattern();
      if (this.atOp(",")) {
        const items = [pat];
        while (this.eatOp(",")) items.push(this.pattern());
        pat = { k: "PTuple", items, ...this.pos(ct) };
      }
      if (this.atKw("if")) this.fail("case guards do not exist in Canon; test the condition inside the case");
      if (this.atOp("|")) this.fail("or-patterns do not exist in Canon; write one case per pattern");
      const body = this.block();
      if (body.length !== 1 || body[0].k === "Comment") {
        this.fail("a case body is exactly one statement: `return e`, `name = e`, or a call (Canon's match is an expression; move longer code into a function)", ct);
      }
      const s = body[0];
      let arm: Arm;
      if (s.k === "Return" && s.value !== null) arm = { kind: "return", value: s.value, tok: ct };
      else if (s.k === "Set") arm = { kind: "assign", target: s.target, plain: PLAIN.has(s), value: s.value, tok: ct };
      else if (s.k === "Let") arm = { kind: "assign", target: { k: "Name", path: [s.name], line: s.line, col: s.col }, plain: true, value: s.value, tok: ct };
      else if (s.k === "ExprStmt") arm = { kind: "call", value: s.expr, tok: ct };
      else this.fail("a case body is `return e`, `name = e`, or a call", ct);
      arms.push([pat, arm]);
    }
    if (this.at("dedent")) this.advance();
    if (arms.length === 0) this.fail("a match needs at least one case", mt);
    const first = arms[0][1];
    for (const [, a] of arms) {
      if (a.kind !== first.kind) this.fail("every case of a match must end the same way: all `return e`, all `name = e` to the same name, or all calls", a.tok);
      if (a.kind === "assign" && !sameNode(a.target, first.target)) this.fail("every case must assign the same name", a.tok);
    }
    const m: A.Match = { k: "Match", subject, arms: arms.map(([pt, a]) => [pt, a.value] as [A.Pattern, A.Expr]), ...this.pos(mt) };
    const p = this.pos(mt);
    if (first.kind === "return") return { k: "Return", value: m, ...p };
    if (first.kind === "call") return { k: "ExprStmt", expr: m, ...p };
    const s: A.SetStmt = { k: "Set", target: first.target!, value: m, ...p };
    if (arms.every(([, a]) => a.plain)) PLAIN.add(s);
    return s;
  }

  // ---------------------------------------------------------------------------- expressions

  expr(): A.Expr {
    let left = this.lambdaExpr();
    while (this.atOp("|>")) {
      // v0.3 pipelines are still read; fmt prints nested calls
      const t = this.advance();
      const stage = this.postfix(this.primary());
      if (stage.k !== "Call") this.fail("each pipeline stage must be a call, like '|> f()'", t, "P005");
      left = { k: "Call", callee: stage.callee, args: [left, ...stage.args], line: stage.line, col: stage.col };
    }
    return left;
  }

  private lambdaExpr(): A.Expr {
    if (this.atKw("lambda")) {
      const t = this.advance();
      const params: string[] = [];
      while (!this.atOp(":")) {
        params.push(this.expect("name", undefined, "lambda parameter").text);
        if (!this.eatOp(",")) break;
      }
      this.expect("op", ":");
      return { k: "Lambda", params, body: this.lambdaExpr(), ...this.pos(t) };
    }
    return this.conditional();
  }

  private conditional(): A.Expr {
    const a = this.orExpr();
    if (this.atKw("if")) {
      const t = this.advance();
      const c = this.orExpr();
      this.expect("kw", "else", "'else' (a conditional expression is `a if cond else b`)");
      const b = this.lambdaExpr();
      return { k: "Match", subject: c, arms: [[boolPat(true, this.pos(t)), a], [boolPat(false, this.pos(t)), b]], ...this.pos(t) };
    }
    return a;
  }

  private orExpr(): A.Expr {
    let left = this.andExpr();
    while (this.atKw("or") || this.atOp("||")) {
      this.advance();
      left = { k: "Binary", op: "or", left, right: this.andExpr(), line: 0, col: 0 };
    }
    return left;
  }

  private andExpr(): A.Expr {
    let left = this.notExpr();
    while (this.atKw("and") || this.atOp("&&")) {
      this.advance();
      left = { k: "Binary", op: "and", left, right: this.notExpr(), line: 0, col: 0 };
    }
    return left;
  }

  private notExpr(): A.Expr {
    if (this.atKw("not")) {
      const t = this.advance();
      return { k: "Unary", op: "not", operand: this.notExpr(), ...this.pos(t) };
    }
    return this.cmpExpr();
  }

  private atComparison(): boolean {
    const t = this.tok;
    return (t.kind === "op" && CMP.has(t.text)) || this.atKw("in") || this.atKw("is") ||
      (this.atKw("not") && this.peek().kind === "kw" && this.peek().text === "in");
  }

  private cmpExpr(): A.Expr {
    const left = this.addExpr();
    if (!this.atComparison()) return left;
    const t = this.tok;
    let out: A.Expr;
    if (this.atKw("in") || this.atKw("not")) {
      const negated = this.atKw("not");
      this.advance();
      if (negated) this.advance();
      const right = this.addExpr();
      const call: A.Expr = { k: "Call", callee: { k: "Name", path: ["contains"], ...this.pos(t) }, args: [right, left], ...this.pos(t) };
      out = negated ? { k: "Unary", op: "not", operand: call, ...this.pos(t) } : call;
    } else if (this.atKw("is")) {
      this.advance();
      const negated = this.atKw("not");
      if (negated) this.advance();
      const right = this.addExpr();
      if (!(right.k === "Ctor" && right.name === "None")) this.fail("`is` compares with None only; compare values with ==", t);
      out = { k: "Binary", op: negated ? "!=" : "==", left, right, line: 0, col: 0 };
    } else {
      const op = this.advance().text;
      out = { k: "Binary", op, left, right: this.addExpr(), line: 0, col: 0 };
    }
    if (this.atComparison()) this.error("end of comparison (comparisons do not chain; use 'and')");
    return out;
  }

  private addExpr(): A.Expr {
    let left = this.mulExpr();
    while (this.atOp("+") || this.atOp("-")) {
      const op = this.advance().text;
      left = { k: "Binary", op, left, right: this.mulExpr(), line: 0, col: 0 };
    }
    return left;
  }

  private mulExpr(): A.Expr {
    let left = this.unary();
    for (;;) {
      if (this.atOp("//")) this.fail("Canon has no //: / on two ints already truncates toward zero (note: not floor)");
      if (this.atOp("**")) this.fail("Canon has no **; use pow(base, exp)");
      if (!(this.atOp("*") || this.atOp("/") || this.atOp("%"))) return left;
      const op = this.advance().text;
      left = { k: "Binary", op, left, right: this.unary(), line: 0, col: 0 };
    }
  }

  private unary(): A.Expr {
    if (this.atOp("-")) {
      const t = this.advance();
      return { k: "Unary", op: "-", operand: this.unary(), ...this.pos(t) };
    }
    if (this.atOp("!")) {
      const t = this.advance();
      return { k: "Unary", op: "not", operand: this.unary(), ...this.pos(t) };
    }
    return this.postfix(this.primary());
  }

  private postfix(e: A.Expr): A.Expr {
    for (;;) {
      if (this.atOp("(")) {
        const open = this.tok;
        if (e.k !== "Name" && e.k !== "Ctor") this.fail("only named functions are called (Canon has no methods or function-valued expressions before '(')", open);
        this.advance();
        e = this.callArgs(e as A.Name | A.Ctor);
      } else if (this.atOp(".")) {
        this.advance();
        const t = this.tok;
        if (t.kind === "int") {
          this.advance();
          e = { k: "FieldGet", obj: e, name: intText(t.text), line: e.line, col: e.col };
        } else if (t.kind === "name") {
          this.advance();
          if (this.atOp("(")) {
            // a module function (`json.stringify(x)`), as in the brace parser; the checker rejects
            // method calls on values (Canon has no methods) and module calls (modules arrive in v1)
            if (e.k !== "Name") this.fail(`Canon has no methods; call ${t.text}(...) as a function with the value as its first argument`, t);
            e = { k: "Name", path: [...e.path, t.text], line: e.line, col: e.col };
            continue;
          }
          e = { k: "FieldGet", obj: e, name: t.text, line: e.line, col: e.col };
        } else {
          this.error("field name after '.'");
        }
      } else if (this.atOp("[")) {
        const t = this.advance();
        if (this.at("int") && this.peek().kind === "op" && this.peek().text === "]") {
          const n = this.advance();
          this.advance();
          e = { k: "FieldGet", obj: e, name: intText(n.text), line: e.line, col: e.col };
        } else {
          this.fail("Canon has no indexing except tuple slots t[0], t[1]; for lists use first, last, take and drop, or a for loop", t);
        }
      } else if (this.atOp("?")) {
        const t = this.advance();
        e = { k: "Try", expr: e, ...(e.line ? { line: e.line, col: e.col } : this.pos(t)) };
      } else {
        return e;
      }
    }
  }

  private callArgs(callee: A.Name | A.Ctor): A.Expr {
    const args: A.Expr[] = [];
    const fields: [string, A.Expr][] = [];
    while (!this.atOp(")")) {
      if (this.at("name") && this.peek().kind === "op" && this.peek().text === "=") {
        const f = this.advance();
        this.advance();
        fields.push([f.text, this.expr()]);
      } else {
        if (fields.length) this.fail("positional arguments cannot follow keyword arguments");
        args.push(this.expr());
        if (this.atKw("for")) this.fail("comprehensions and generators do not exist in Canon; use map and filter");
      }
      if (!this.eatOp(",")) break;
    }
    this.expect("op", ")");
    if (callee.k === "Ctor" && (fields.length || args.length === 0)) {
      if (args.length) this.fail(`build a record with keyword arguments only: ${callee.name}(field=value, ...)`, callee as unknown as PyTok);
      return { k: "Record", tname: callee.name, fields, line: callee.line, col: callee.col };
    }
    if (fields.length) {
      throw new CanonError(diag("P001", "keyword arguments do not exist in Canon; pass arguments in order (records use keywords: Item(sku=...))", callee.line, callee.col));
    }
    return { k: "Call", callee, args, line: callee.line, col: callee.col };
  }

  private primary(): A.Expr {
    const t = this.tok;
    const p = this.pos(t);
    switch (t.kind) {
      case "int":
        this.advance();
        return { k: "Int", value: intText(t.text), ...p };
      case "float": {
        this.advance();
        const value = Number(t.text);
        if (!Number.isFinite(value)) this.fail(`float literal ${t.text} is out of range`, t);
        return { k: "Float", value, ...p };
      }
      case "str":
        this.advance();
        return { k: "Str", raw: t.text, ...p };
      case "fstr":
        this.advance();
        return this.fstring(t);
      case "hole":
        this.advance();
        return { k: "Hole", name: t.text.slice(1), ...p };
      case "tname":
        this.advance();
        if (t.text === "True" || t.text === "False") return { k: "Bool", value: t.text === "True", ...p };
        return { k: "Ctor", name: t.text, ...p };
      case "name":
        this.advance();
        if (t.text === "true" || t.text === "false") return { k: "Bool", value: t.text === "true", ...p };
        return { k: "Name", path: [t.text], ...p };
      default:
        break;
    }
    if (this.atOp("...")) {
      this.advance();
      return { k: "Hole", name: "", ...p };
    }
    if (this.atOp("(")) {
      this.advance();
      if (this.atOp(")")) this.fail("() is not a value in Canon", t);
      const first = this.expr();
      if (this.atKw("for")) this.fail("generator expressions do not exist in Canon; use map and filter");
      if (this.eatOp(",")) {
        const items = [first];
        while (!this.atOp(")")) {
          items.push(this.expr());
          if (!this.eatOp(",")) break;
        }
        this.expect("op", ")");
        return { k: "TupleLit", items, ...p };
      }
      this.expect("op", ")");
      return first;
    }
    if (this.atOp("[")) {
      this.advance();
      const items: A.Expr[] = [];
      while (!this.atOp("]")) {
        items.push(this.expr());
        if (this.atKw("for")) this.fail("list comprehensions do not exist in Canon; use map and filter");
        if (!this.eatOp(",")) break;
      }
      this.expect("op", "]");
      return { k: "ListLit", items, ...p };
    }
    if (this.atOp("{")) this.fail("dict and set literals do not exist in Canon; build a map with map_from([(key, value), ...])");
    if (this.atKw("match")) this.fail("match is a statement in Canon-Py; return its value or bind it to a name, then use the name", t, "S001");
    if (this.atOp("|") || this.atOp("||")) {
      // v0.3 lambda spelling, still read
      const params: string[] = [];
      if (this.eatOp("|")) {
        while (!this.atOp("|")) {
          params.push(this.expect("name", undefined, "lambda parameter").text);
          if (!this.eatOp(",")) break;
        }
        this.expect("op", "|");
      } else this.advance();
      return { k: "Lambda", params, body: this.conditional(), ...p };
    }
    return this.error("an expression");
  }

  /** f"a{x}b" is "a" + to_string(x) + "b"; f"{x}" alone is to_string(x). */
  private fstring(t: PyTok): A.Expr {
    const q = t.text[0];
    const body = t.text.slice(1);
    const parts: A.Expr[] = [];
    let lit = "";
    const p = this.pos(t);
    const flush = () => {
      if (lit !== "") parts.push({ k: "Str", raw: `"${requote(lit, q)}"`, ...p });
      lit = "";
    };
    let k = 0;
    while (k < body.length) {
      const c = body[k];
      if (c === "\\") {
        lit += body.slice(k, k + 2);
        k += 2;
      } else if (c === "{" && body[k + 1] === "{") {
        lit += "{";
        k += 2;
      } else if (c === "}" && body[k + 1] === "}") {
        lit += "}";
        k += 2;
      } else if (c === "}") {
        this.fail("single '}' in an f-string; write '}}' for a literal brace", t);
      } else if (c === "{") {
        let depth = 0;
        let j = k + 1;
        let quote: string | null = null;
        for (; j < body.length; j++) {
          const d = body[j];
          if (quote) {
            if (d === "\\") j++;
            else if (d === quote) quote = null;
          } else if (d === '"' || d === "'") quote = d;
          else if (d === "(" || d === "[" || d === "{") depth++;
          else if ((d === ")" || d === "]") && depth > 0) depth--;
          else if (d === "}") {
            if (depth === 0) break;
            depth--;
          } else if (depth === 0 && (d === ":" || (d === "!" && body[j + 1] !== "=") || (d === "=" && body[j + 1] === "}"))) {
            this.fail("format specs and conversions in f-strings do not exist in Canon; format with a function", t);
          }
        }
        if (j >= body.length) this.fail("unterminated '{' in an f-string", t);
        const inner = body.slice(k + 1, j);
        flush();
        const sub = new PyParser(pyLex(inner, { fragment: true, line: t.line, col: t.col + 2 + k + 1 }));
        const e = sub.expr();
        if (!sub.at("eof")) sub.error("'}'");
        parts.push({ k: "Call", callee: { k: "Name", path: ["to_string"], line: e.line || t.line, col: e.col || t.col }, args: [e], line: e.line || t.line, col: e.col || t.col });
        k = j + 1;
      } else {
        lit += c;
        k++;
      }
    }
    flush();
    if (parts.length === 0) return { k: "Str", raw: '""', ...p };
    return parts.slice(1).reduce<A.Expr>((l, r) => ({ k: "Binary", op: "+", left: l, right: r, line: 0, col: 0 }), parts[0]);
  }

  private pattern(): A.Pattern {
    const t = this.tok;
    const p = this.pos(t);
    if (t.kind === "name") {
      this.advance();
      return t.text === "_" ? { k: "PWild", ...p } : { k: "PBind", name: t.text, ...p };
    }
    if (t.kind === "tname" && (t.text === "True" || t.text === "False")) {
      this.advance();
      return { k: "PLit", lit: { k: "Bool", value: t.text === "True", ...p }, ...p };
    }
    if (t.kind === "int" || t.kind === "float" || t.kind === "str" || this.atOp("-")) {
      return { k: "PLit", lit: this.unary(), ...p };
    }
    if (t.kind === "tname") {
      this.advance();
      const args: A.Pattern[] = [];
      if (this.eatOp("(")) {
        while (!this.atOp(")")) {
          if (this.at("name") && this.peek().kind === "op" && this.peek().text === "=") {
            this.fail("keyword patterns do not exist in Canon; match variant fields by position");
          }
          args.push(this.pattern());
          if (!this.eatOp(",")) break;
        }
        this.expect("op", ")");
      }
      return { k: "PCtor", name: t.text, args, ...p };
    }
    if (this.eatOp("(")) {
      const items = [this.pattern()];
      while (this.eatOp(",")) {
        if (this.atOp(")")) break;
        items.push(this.pattern());
      }
      this.expect("op", ")");
      return items.length === 1 ? items[0] : { k: "PTuple", items, ...p };
    }
    if (this.atOp("[")) this.fail("list patterns do not exist in Canon; match on first(xs) or use len(xs)");
    return this.error("a pattern");
  }
}

// --------------------------------------------------------------------------- binding inference

type Binding = { kind: "param"; name: string } | { kind: "let"; node: A.Let } | { kind: "fixed" };

/**
 * Python-shaped bindings: `x = e` binds a new name when x is not visible, and assigns otherwise
 * (which makes the original binding a var). Scopes are Canon's (block scoped). Assigning to a
 * parameter rebinds a local copy: the body gets a leading `var p = p`, which the printer omits.
 */
export function resolveBindings(params: string[], body: A.Stmt[], at: A.Pos = { line: 0, col: 0 }): A.Stmt[] {
  const scopes: Map<string, Binding>[] = [new Map(params.map((n) => [n, { kind: "param", name: n } as Binding]))];
  const mutated = new Set<string>();
  const lookup = (n: string) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const b = scopes[i].get(n);
      if (b) return b;
    }
    return undefined;
  };
  const rootName = (e: A.Expr): string | null => {
    while (e.k === "FieldGet") e = e.obj;
    return e.k === "Name" && e.path.length === 1 ? e.path[0] : null;
  };
  const walk = (stmts: A.Stmt[], fresh: Map<string, Binding> | null): A.Stmt[] => {
    if (fresh) scopes.push(fresh);
    const cur = scopes[scopes.length - 1];
    const out = stmts.map((s): A.Stmt => {
      switch (s.k) {
        case "Let":
          cur.set(s.name, { kind: "let", node: s });
          return s;
        case "Set": {
          const root = rootName(s.target);
          const b = root === null ? undefined : lookup(root);
          if (PLAIN.has(s) && s.target.k === "Name" && b === undefined) {
            const node: A.Let = { k: "Let", name: s.target.path[0], value: s.value, mutable: false, line: s.line, col: s.col };
            cur.set(node.name, { kind: "let", node });
            return node;
          }
          if (b?.kind === "let") b.node.mutable = true;
          else if (b?.kind === "param") mutated.add(b.name);
          return s;
        }
        case "If":
          return { ...s, body: walk(s.body, new Map()), orelse: s.orelse === null ? null : walk(s.orelse, new Map()) };
        case "ForIn": {
          const names = s.names ?? [s.var];
          return { ...s, body: walk(s.body, new Map(names.map((n) => [n, { kind: "fixed" } as Binding]))) };
        }
        case "ForWhile":
          return { ...s, body: walk(s.body, new Map()) };
        default:
          return s;
      }
    });
    if (fresh) scopes.pop();
    return out;
  };
  const resolved = walk(body, new Map());
  const copies: A.Stmt[] = params.filter((n) => mutated.has(n)).map((n) => ({
    k: "Let", name: n, value: { k: "Name", path: [n], ...at }, mutable: true, ...at,
  }));
  return [...copies, ...resolved];
}

export function pyParse(src: string): A.Program {
  return new PyParser(pyLex(src)).program();
}

/**
 * Which surface a file is written in. A file is Canon-Py when a top-level line starts with
 * `def`, `class`, `@`, `import` or `from`; otherwise it is brace syntax (v0 to v0.3). Files with neither
 * (comments, or only one-line sum types) mean the same either way.
 */
export function isPySource(src: string): boolean {
  return /^(def |class |@|import |from )/m.test(src);
}
