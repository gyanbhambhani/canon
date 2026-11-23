/** Lenient parser: whitespace, parens, commas and pipeline-vs-call are free. Port of canon.py. */
import type * as A from "./ast.js";
import { CanonError, diag } from "./diagnostics.js";
import { features } from "./features.js";
import { lex, type Tok, type TokKind } from "./lexer.js";
import { pyRepr } from "./py.js";
import { isPySource, pyParse } from "./pyparser.js";

const CMP = new Set(["==", "!=", "<", "<=", ">", ">="]);

export function intText(t: string): string {
  const s = t.replace(/^0+/, "");
  return s === "" ? "0" : s;
}

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export class Parser {
  private i = 0;
  private ns = false; // "no struct": a TypeName followed by '{' is not a record literal

  constructor(private readonly toks: Tok[]) {}

  private get tok(): Tok {
    return this.toks[this.i];
  }

  private peek(k = 1): Tok {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)];
  }

  private at(kind: TokKind, text?: string): boolean {
    const t = this.tok;
    return t.kind === kind && (text === undefined || t.text === text);
  }

  private atOp(text: string) {
    return this.at("op", text);
  }

  private atKw(text: string) {
    return this.at("kw", text);
  }

  private advance(): Tok {
    return this.toks[this.i++];
  }

  private error(expected: string): never {
    const t = this.tok;
    const found = t.kind === "eof" ? "end of file" : pyRepr(t.text);
    throw new CanonError(diag("P001", `expected ${expected}, found ${found}`, t.line, t.col));
  }

  /** P001 with a free-form message at the current token. */
  private fail(message: string): never {
    throw new CanonError(diag("P001", message, this.tok.line, this.tok.col));
  }

  private expect(kind: TokKind, text?: string, what?: string): Tok {
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

  private pos(t: Tok): A.Pos {
    return { line: t.line, col: t.col };
  }

  private noComment() {
    if (this.at("comment")) {
      const t = this.tok;
      throw new CanonError(diag("P002", "comments must sit on their own line between statements", t.line, t.col));
    }
  }

  program(): A.Program {
    const items: A.Item[] = [];
    while (!this.at("eof")) items.push(this.item());
    return { k: "Program", items };
  }

  private item(): A.Item {
    const t = this.tok;
    if (t.kind === "comment") {
      this.advance();
      return { k: "Comment", text: t.text, ...this.pos(t) };
    }
    if (this.atKw("use")) {
      this.advance();
      const path = [this.expect("name", undefined, "module name").text];
      while (this.eatOp(".")) {
        if (this.atOp("{")) {
          // v0.5: `use todos.{NewTodo, Todo}` names what it takes
          this.advance();
          const names: string[] = [];
          while (!this.atOp("}")) {
            const n = this.tok;
            if (n.kind !== "name" && n.kind !== "tname") this.error("an imported name");
            names.push(this.advance().text);
            if (!this.eatOp(",")) break;
          }
          this.expect("op", "}");
          if (!names.length) this.fail("an import names at least one item: use module.{Name}");
          return { k: "Use", path, names, ...this.pos(t) };
        }
        path.push(this.expect("name", undefined, "module name").text);
      }
      return { k: "Use", path, ...this.pos(t) };
    }
    if (this.atKw("type")) return this.typeDecl();
    if (this.atKw("fn")) return this.fnDecl();
    // v0.5: `api fn` and `table` are contextual, so `api` and `table` stay usable as names
    if (t.kind === "name" && t.text === "api" && this.peek().kind === "kw" && this.peek().text === "fn") {
      this.advance();
      return this.fnDecl(true);
    }
    if (t.kind === "name" && t.text === "table" && this.peek().kind === "name" && this.peek(2).kind === "op" && this.peek(2).text === ":") {
      this.advance();
      const name = this.advance().text;
      this.advance();
      const row = this.expect("tname", undefined, "the row's record type").text;
      if (!(this.tok.kind === "name" && this.tok.text === "key")) this.error("'key' and the key field: table todos: Todo key id");
      this.advance();
      const key = this.expect("name", undefined, "key field name").text;
      return { k: "Table", name, row, key, ...this.pos(t) };
    }
    if (this.atKw("test")) {
      this.advance();
      const name = this.expect("str", undefined, "test name string").text;
      // v0.3: a test may declare the real effects (fs, net) it uses, like a function
      const effects: string[] = [];
      while (this.atKw("effects")) {
        this.advance();
        this.expect("op", ":");
        effects.push(this.effectName());
        while (this.eatOp(",")) effects.push(this.effectName());
      }
      return { k: "Test", name, effects, body: this.block(), ...this.pos(t) };
    }
    return this.error("'use', 'type', 'fn', or 'test' at top level");
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

  private typeDecl(): A.RecordType | A.SumType {
    const t = this.advance();
    const name = this.expect("tname", undefined, "type name").text;
    const params = this.tparams();
    if (this.eatOp("{")) {
      const fields: [string, A.TypeExpr][] = [];
      while (!this.atOp("}")) {
        this.noComment();
        const fname = this.expect("name", undefined, "field name").text;
        this.expect("op", ":");
        fields.push([fname, this.typeExpr()]);
        this.eatOp(",");
      }
      this.expect("op", "}");
      return { k: "RecordType", name, params, fields, ...this.pos(t) };
    }
    this.expect("op", "=", "'{' or '='");
    this.eatOp("|");
    const variants = [this.variant()];
    while (this.eatOp("|")) variants.push(this.variant());
    return { k: "SumType", name, params, variants, ...this.pos(t) };
  }

  private variant(): A.Variant {
    const name = this.expect("tname", undefined, "variant name").text;
    const fields: [string, A.TypeExpr][] = [];
    if (this.eatOp("(")) {
      while (!this.atOp(")")) {
        const fname = this.expect("name", undefined, "field name").text;
        this.expect("op", ":");
        fields.push([fname, this.typeExpr()]);
        if (!this.eatOp(",")) break;
      }
      this.expect("op", ")");
    }
    return [name, fields];
  }

  typeExpr(): A.TypeExpr {
    const t = this.tok;
    if (this.atKw("fn")) {
      this.advance();
      this.expect("op", "(");
      const ps: A.TypeExpr[] = [];
      while (!this.atOp(")")) {
        ps.push(this.typeExpr());
        if (!this.eatOp(",")) break;
      }
      this.expect("op", ")");
      this.expect("op", "->");
      const ret = this.typeExpr();
      // v0.4: `fn(A) -> B effects: io, net` (on the same line; a clause on its own line belongs to
      // the enclosing function). An effect name followed by ':' is the next parameter, not an effect.
      const effects: string[] = [];
      if (this.atKw("effects") && this.tok.line === this.toks[this.i - 1].line) {
        this.advance();
        this.expect("op", ":");
        effects.push(this.expect("name", undefined, "effect name").text);
        while (this.atOp(",") && this.peek().kind === "name" && !(this.peek(2).kind === "op" && this.peek(2).text === ":")) {
          this.advance();
          effects.push(this.advance().text);
        }
      }
      return { k: "TFn", params: ps, ret, ...(effects.length ? { effects } : {}), ...this.pos(t) };
    }
    if (this.eatOp("(")) {
      const items = [this.typeExpr()];
      while (this.eatOp(",")) {
        if (this.atOp(")")) break;
        items.push(this.typeExpr());
      }
      this.expect("op", ")");
      if (items.length === 1) return items[0];
      return { k: "TTuple", items, ...this.pos(t) };
    }
    const name = this.expect("tname", undefined, "a type").text;
    const args: A.TypeExpr[] = [];
    if (this.eatOp("[")) {
      args.push(this.typeExpr());
      while (this.eatOp(",")) {
        if (this.atOp("]")) break;
        args.push(this.typeExpr());
      }
      this.expect("op", "]");
    }
    return { k: "TName", name, args, ...this.pos(t) };
  }

  /**
   * An effect: a name, or (v0.5) a name with one argument on the same line, `store(todos)` or
   * `net(api.stripe.com)`. The argument is the tokens' text joined, so a host keeps its dots and
   * hyphens; check.ts validates it.
   */
  private effectName(): string {
    const name = this.expect("name", undefined, "effect name");
    if (!this.atOp("(") || this.tok.line !== name.line) return name.text;
    this.advance();
    let arg = "";
    while (!this.atOp(")")) {
      if (this.at("eof") || this.tok.line !== name.line) this.error("')' closing the effect's argument");
      arg += this.advance().text;
    }
    this.advance();
    if (arg === "") this.fail(`effect ${name.text}() needs an argument, like store(todos) or net(api.example.com)`);
    return `${name.text}(${arg})`;
  }

  private fnDecl(api = false): A.Fn {
    const fnTok = this.tok;
    this.advance();
    const nameTok = this.expect("name", undefined, "function name");
    const tparams = this.tparams();
    this.expect("op", "(");
    const params: [string, A.TypeExpr][] = [];
    while (!this.atOp(")")) {
      const pname = this.expect("name", undefined, "parameter name").text;
      this.expect("op", ":");
      params.push([pname, this.typeExpr()]);
      if (!this.eatOp(",")) break;
    }
    this.expect("op", ")");
    this.expect("op", "->", "'->' and a return type (return types are required)");
    const ret = this.typeExpr();
    const effects: string[] = [];
    let requires: A.Expr | null = null;
    let ensures: A.Expr | null = null;
    let route: A.Route | undefined;
    const atRoute = () => this.tok.kind === "name" && this.tok.text === "route" && this.peek().kind === "op" && this.peek().text === ":";
    while (this.atKw("effects") || this.atKw("requires") || this.atKw("ensures") || atRoute()) {
      const kwTok = this.advance();
      const kw = kwTok.text;
      this.expect("op", ":");
      if (kw === "route") {
        if (!api) {
          throw new CanonError(diag("P001", `a route: clause belongs to an api fn; write 'api fn ${nameTok.text}'`, kwTok.line, kwTok.col));
        }
        if (route) this.fail("an api fn has one route: clause");
        const m = this.tok;
        if (!(m.kind === "tname" && HTTP_METHODS.has(m.text))) this.error("an HTTP method: GET, POST, PUT, PATCH or DELETE");
        this.advance();
        const p = this.expect("str", undefined, "the route's path as a string literal");
        const path = p.text.slice(1, -1);
        if (path.includes("\\")) throw new CanonError(diag("P001", "a route path has no escapes", p.line, p.col));
        if (!path.startsWith("/")) throw new CanonError(diag("P001", `a route path starts with /: "/${path}"`, p.line, p.col));
        route = { method: m.text as A.Route["method"], path };
      } else if (kw === "effects") {
        effects.push(this.effectName());
        while (this.eatOp(",")) effects.push(this.effectName());
      } else {
        const e = this.expr(true);
        if (kw === "requires") {
          requires = requires === null ? e : { k: "Binary", op: "and", left: requires, right: e, line: 0, col: 0 };
        } else {
          ensures = ensures === null ? e : { k: "Binary", op: "and", left: ensures, right: e, line: 0, col: 0 };
        }
      }
    }
    if (api && !route) {
      throw new CanonError(diag("P001", `api fn ${nameTok.text} needs a route: clause, like route: GET "/items"`, fnTok.line, fnTok.col));
    }
    const body = this.block();
    return {
      k: "Fn", name: nameTok.text, tparams, params, ret, effects, requires, ensures, body,
      ...(route ? { route } : {}), ...this.pos(nameTok),
    };
  }

  // statements
  private block(): A.Stmt[] {
    this.expect("op", "{");
    const stmts: A.Stmt[] = [];
    while (!this.atOp("}")) {
      if (this.at("eof")) this.error("'}'");
      stmts.push(this.stmt());
    }
    this.advance();
    return stmts;
  }

  private stmt(): A.Stmt {
    const t = this.tok;
    const p = this.pos(t);
    if (t.kind === "comment") {
      this.advance();
      return { k: "Comment", text: t.text, ...p };
    }
    if (this.atKw("let") || this.atKw("var")) {
      const mutable = this.advance().text === "var";
      const name = this.expect("name", undefined, "binding name").text;
      if (this.atOp(":")) {
        throw new CanonError(diag("P003", "local bindings never carry type annotations; types live on signatures",
          this.tok.line, this.tok.col));
      }
      this.expect("op", "=");
      return { k: "Let", name, value: this.expr(), mutable, ...p };
    }
    if (this.atKw("set")) {
      // v0 spelling of assignment; still accepted, printed as `target = value` (v0.2)
      this.advance();
      const target = this.postfix(this.primary());
      this.expect("op", "=");
      return { k: "Set", target, value: this.expr(), ...p };
    }
    if (this.atKw("while")) {
      this.advance();
      const cond = this.expr(true);
      return { k: "ForWhile", cond, body: this.block(), ...p };
    }
    if (this.atKw("return")) {
      this.advance();
      if (this.atOp("}")) return { k: "Return", value: null, ...p };
      return { k: "Return", value: this.expr(), ...p };
    }
    if (this.atKw("if")) return this.ifStmt();
    if (this.at("name", "break") && features().break) {
      // v0.3: `break` alone on its line (a contextual keyword, so it stays usable as a name)
      const next = this.peek();
      if (next.kind === "eof" || next.line !== t.line || (next.kind === "op" && next.text === "}")) {
        this.advance();
        return { k: "Break", ...p };
      }
    }
    if (this.atKw("for")) {
      this.advance();
      if (features().destructure && this.atOp("(") && this.peek().kind === "name") {
        // v0.3: `for (a, b) in xs`
        const save = this.i;
        this.advance();
        const names = [this.advance().text];
        while (this.eatOp(",")) {
          if (this.atOp(")")) break;
          names.push(this.expect("name", undefined, "loop variable").text);
        }
        if (this.eatOp(")") && this.atKw("in") && names.length >= 2) {
          this.advance();
          const it = this.expr(true);
          return { k: "ForIn", var: "", names, iterable: it, body: this.block(), ...p };
        }
        this.i = save;
      }
      if (this.at("name") && this.peek().kind === "kw" && this.peek().text === "in") {
        const v = this.advance().text;
        this.advance();
        const it = this.expr(true);
        return { k: "ForIn", var: v, iterable: it, body: this.block(), ...p };
      }
      const cond = this.expr(true);
      return { k: "ForWhile", cond, body: this.block(), ...p };
    }
    const e = this.expr();
    if (this.atOp("=") && (e.k === "Name" || e.k === "FieldGet")) {
      // v0.2 assignment: `x = e` or `x.field = e`
      this.advance();
      return { k: "Set", target: e, value: this.expr(), ...p };
    }
    const inner = e.k === "Try" ? e.expr : e;
    if (inner.k !== "Call") {
      throw new CanonError(diag("P004",
        "an expression statement must be a function call; bind other values with let", t.line, t.col));
    }
    return { k: "ExprStmt", expr: e, ...p };
  }

  private ifStmt(): A.If {
    const t = this.advance();
    const cond = this.expr(true);
    const body = this.block();
    let orelse: A.Stmt[] | null = null;
    if (this.atKw("else")) {
      this.advance();
      orelse = this.atKw("if") ? [this.ifStmt()] : this.block();
    }
    return { k: "If", cond, body, orelse, ...this.pos(t) };
  }

  // expressions
  expr(noStruct = false): A.Expr {
    const saved = this.ns;
    this.ns = noStruct;
    try {
      return this.pipe();
    } finally {
      this.ns = saved;
    }
  }

  private pipe(): A.Expr {
    let left = this.orExpr();
    while (this.atOp("|>")) {
      const t = this.advance();
      const stage = this.postfix(this.primary());
      if (stage.k !== "Call") {
        throw new CanonError(diag("P005", "each pipeline stage must be a call, like '|> f()'", t.line, t.col));
      }
      left = { k: "Call", callee: stage.callee, args: [left, ...stage.args], line: stage.line, col: stage.col };
    }
    return left;
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

  private cmpExpr(): A.Expr {
    const left = this.addExpr();
    if (this.tok.kind === "op" && CMP.has(this.tok.text)) {
      const op = this.advance().text;
      const right = this.addExpr();
      if (this.tok.kind === "op" && CMP.has(this.tok.text)) {
        this.error(`end of comparison (comparisons do not chain; use '${features().symbols ? "&&" : "and"}')`);
      }
      return { k: "Binary", op, left, right, line: 0, col: 0 };
    }
    return left;
  }

  private addExpr(): A.Expr {
    let left = this.mulExpr();
    while (this.tok.kind === "op" && (this.tok.text === "+" || this.tok.text === "-")) {
      const op = this.advance().text;
      left = { k: "Binary", op, left, right: this.mulExpr(), line: 0, col: 0 };
    }
    return left;
  }

  private mulExpr(): A.Expr {
    let left = this.unary();
    while (this.tok.kind === "op" && (this.tok.text === "*" || this.tok.text === "/" || this.tok.text === "%")) {
      const op = this.advance().text;
      left = { k: "Binary", op, left, right: this.unary(), line: 0, col: 0 };
    }
    return left;
  }

  private unary(): A.Expr {
    if (this.atOp("!")) {
      // v0.3: `!` is a unary operator, binding as tightly as unary minus
      const t = this.advance();
      return { k: "Unary", op: "not", operand: this.unary(), ...this.pos(t) };
    }
    if (this.atOp("-")) {
      const t = this.advance();
      return { k: "Unary", op: "-", operand: this.unary(), ...this.pos(t) };
    }
    if (this.atKw("try")) {
      const t = this.advance();
      return { k: "Try", expr: this.unary(), ...this.pos(t) };
    }
    return this.postfix(this.primary());
  }

  private postfix(e: A.Expr): A.Expr {
    for (;;) {
      // A call's '(' must be on the callee's line; a '(' on a new line starts a new
      // statement. This is the only place where a line break matters.
      if (this.atOp("(") && this.tok.line === this.toks[this.i - 1].line) {
        if (e.k !== "Name" && e.k !== "Ctor") this.error("a named function before '(' (only named functions are called)");
        this.advance();
        const args = this.argsUntil(")");
        e = { k: "Call", callee: e as A.Name | A.Ctor, args, line: e.line, col: e.col };
      } else if (this.atOp(".")) {
        this.advance();
        const t = this.tok;
        if (t.kind === "name" || t.kind === "int") {
          this.advance();
          if (e.k === "Name" && t.kind === "name" && !this.atOp(".") && this.atOp("(")) {
            e = { k: "Name", path: [...e.path, t.text], line: e.line, col: e.col };
          } else {
            e = { k: "FieldGet", obj: e, name: t.text, line: e.line, col: e.col };
          }
        } else {
          this.error("field name after '.'");
        }
      } else {
        return e;
      }
    }
  }

  private argsUntil(close: string): A.Expr[] {
    const args: A.Expr[] = [];
    const saved = this.ns;
    this.ns = false;
    while (!this.atOp(close)) {
      args.push(this.expr());
      if (!this.eatOp(",")) break;
    }
    this.ns = saved;
    this.expect("op", close);
    return args;
  }

  private primary(): A.Expr {
    const t = this.tok;
    const p = this.pos(t);
    if (t.kind === "int") {
      this.advance();
      return { k: "Int", value: intText(t.text), ...p };
    }
    if (t.kind === "float") {
      this.advance();
      const value = Number(t.text);
      if (!Number.isFinite(value)) {
        // the oracle crashes here (repr(inf)); Canon reports it (see DECISIONS.md)
        throw new CanonError(diag("P001", `float literal ${t.text} is out of range`, t.line, t.col));
      }
      return { k: "Float", value, ...p };
    }
    if (t.kind === "str") {
      this.advance();
      return { k: "Str", raw: t.text, ...p };
    }
    if (t.kind === "hole") {
      this.advance();
      return { k: "Hole", name: t.text.slice(1), ...p };
    }
    if (this.atKw("true") || this.atKw("false")) {
      this.advance();
      return { k: "Bool", value: t.text === "true", ...p };
    }
    if (t.kind === "name") {
      this.advance();
      return { k: "Name", path: [t.text], ...p };
    }
    if (t.kind === "tname") {
      this.advance();
      if (this.atOp("{") && !this.ns) {
        this.advance();
        const fields: [string, A.Expr][] = [];
        const saved = this.ns;
        this.ns = false;
        while (!this.atOp("}")) {
          const fname = this.expect("name", undefined, "field name").text;
          this.expect("op", ":");
          fields.push([fname, this.expr()]);
          if (!this.eatOp(",")) break;
        }
        this.ns = saved;
        this.expect("op", "}");
        return { k: "Record", tname: t.text, fields, ...p };
      }
      return { k: "Ctor", name: t.text, ...p };
    }
    if (this.atOp("(")) {
      this.advance();
      const saved = this.ns;
      this.ns = false;
      const first = this.expr();
      if (this.eatOp(",")) {
        const items = [first];
        while (!this.atOp(")")) {
          items.push(this.expr());
          if (!this.eatOp(",")) break;
        }
        this.ns = saved;
        this.expect("op", ")");
        return { k: "TupleLit", items, ...p };
      }
      this.ns = saved;
      this.expect("op", ")");
      return first;
    }
    if (this.atOp("[")) {
      this.advance();
      return { k: "ListLit", items: this.argsUntil("]"), ...p };
    }
    if (this.atOp("||")) {
      // a lambda with no parameters, `|| e`
      this.advance();
      const saved = this.ns;
      this.ns = false;
      const body = this.orExpr();
      this.ns = saved;
      return { k: "Lambda", params: [], body, ...p };
    }
    if (this.atOp("|")) {
      this.advance();
      const params: string[] = [];
      while (!this.atOp("|")) {
        params.push(this.expect("name", undefined, "lambda parameter").text);
        if (!this.eatOp(",")) break;
      }
      this.expect("op", "|");
      const saved = this.ns;
      this.ns = false;
      const body = this.orExpr();
      this.ns = saved;
      return { k: "Lambda", params, body, ...p };
    }
    if (this.atKw("match")) {
      this.advance();
      const subject = this.expr(true);
      this.expect("op", "{");
      const arms: [A.Pattern, A.Expr][] = [];
      const saved = this.ns;
      this.ns = false;
      while (!this.atOp("}")) {
        this.noComment();
        const pat = this.pattern();
        this.expect("op", "=>");
        arms.push([pat, this.expr()]);
        this.eatOp(",");
      }
      this.ns = saved;
      this.expect("op", "}");
      return { k: "Match", subject, arms, ...p };
    }
    return this.error("an expression");
  }

  private pattern(): A.Pattern {
    const t = this.tok;
    const p = this.pos(t);
    if (t.kind === "name") {
      this.advance();
      return t.text === "_" ? { k: "PWild", ...p } : { k: "PBind", name: t.text, ...p };
    }
    if (t.kind === "int" || t.kind === "float" || t.kind === "str" || this.atKw("true") || this.atKw("false") || this.atOp("-")) {
      return { k: "PLit", lit: this.unary(), ...p };
    }
    if (t.kind === "tname") {
      this.advance();
      const args: A.Pattern[] = [];
      if (this.eatOp("(")) {
        while (!this.atOp(")")) {
          args.push(this.pattern());
          if (!this.eatOp(",")) break;
        }
        this.expect("op", ")");
      }
      return { k: "PCtor", name: t.text, args, ...p };
    }
    if (this.eatOp("(")) {
      const items = [this.pattern()];
      while (this.eatOp(",")) items.push(this.pattern());
      this.expect("op", ")");
      return { k: "PTuple", items, ...p };
    }
    return this.error("a pattern");
  }
}

/** Parse either surface: Canon-Py (v0.4) or brace syntax (v0 to v0.3), detected per file. */
export function parse(src: string): A.Program {
  if (isPySource(src)) return pyParse(src);
  try {
    return new Parser(lex(src)).program();
  } catch (e) {
    // a Canon-Py file with no def, class, decorator or import (only type declarations): if it
    // reads as Canon-Py, it is Canon-Py; otherwise the brace parser's error stands
    if (!(e instanceof CanonError)) throw e;
    try {
      return pyParse(src);
    } catch {
      throw e;
    }
  }
}
