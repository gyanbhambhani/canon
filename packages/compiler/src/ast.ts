/** AST, mirroring the dataclasses in reference/canon.py. line/col never take part in equality. */
export interface Pos {
  line: number;
  col: number;
}

// types
export type TypeExpr =
  | ({ k: "TName"; name: string; args: TypeExpr[] } & Pos)
  /** v0.4: `effects` lists the effects calling a value of this type performs (absent or empty: pure). */
  | ({ k: "TFn"; params: TypeExpr[]; ret: TypeExpr; effects?: string[] } & Pos)
  | ({ k: "TTuple"; items: TypeExpr[] } & Pos);

// expressions
export type IntLit = { k: "Int"; value: string } & Pos; // decimal digits, no leading zeros
export type FloatLit = { k: "Float"; value: number } & Pos;
export type StrLit = { k: "Str"; raw: string } & Pos; // includes quotes, escapes preserved
export type BoolLit = { k: "Bool"; value: boolean } & Pos;
export type Name = { k: "Name"; path: string[] } & Pos;
export type Ctor = { k: "Ctor"; name: string } & Pos;
export type Call = { k: "Call"; callee: Name | Ctor; args: Expr[] } & Pos;
export type FieldGet = { k: "FieldGet"; obj: Expr; name: string } & Pos;
export type Binary = { k: "Binary"; op: string; left: Expr; right: Expr } & Pos;
export type Unary = { k: "Unary"; op: "-" | "not"; operand: Expr } & Pos;
export type Lambda = { k: "Lambda"; params: string[]; body: Expr } & Pos;
export type ListLit = { k: "ListLit"; items: Expr[] } & Pos;
export type TupleLit = { k: "TupleLit"; items: Expr[] } & Pos;
export type RecordLit = { k: "Record"; tname: string; fields: [string, Expr][] } & Pos;
export type Match = { k: "Match"; subject: Expr; arms: [Pattern, Expr][] } & Pos;
export type Hole = { k: "Hole"; name: string } & Pos;
export type Try = { k: "Try"; expr: Expr } & Pos;

export type Expr =
  | IntLit | FloatLit | StrLit | BoolLit | Name | Ctor | Call | FieldGet | Binary | Unary
  | Lambda | ListLit | TupleLit | RecordLit | Match | Hole | Try;

// patterns
export type Pattern =
  | ({ k: "PWild" } & Pos)
  | ({ k: "PBind"; name: string } & Pos)
  | ({ k: "PLit"; lit: Expr } & Pos)
  | ({ k: "PCtor"; name: string; args: Pattern[] } & Pos)
  | ({ k: "PTuple"; items: Pattern[] } & Pos);

// statements
export type Comment = { k: "Comment"; text: string } & Pos;
export type Let = { k: "Let"; name: string; value: Expr; mutable: boolean } & Pos;
export type SetStmt = { k: "Set"; target: Expr; value: Expr } & Pos;
export type Return = { k: "Return"; value: Expr | null } & Pos;
export type If = { k: "If"; cond: Expr; body: Stmt[]; orelse: Stmt[] | null } & Pos;
/** v0.3: `names` is set when the loop destructures tuples, `for (a, b) in xs` (then `var` is ""). */
export type ForIn = { k: "ForIn"; var: string; names?: string[]; iterable: Expr; body: Stmt[] } & Pos;
export type ForWhile = { k: "ForWhile"; cond: Expr; body: Stmt[] } & Pos;
export type ExprStmt = { k: "ExprStmt"; expr: Expr } & Pos;
/** v0.3: exits the innermost loop. */
export type Break = { k: "Break" } & Pos;
export type Stmt = Comment | Let | SetStmt | Return | If | ForIn | ForWhile | ExprStmt | Break;

// items
/** v0.5: `names` is set for a project import, `use todos.{NewTodo, Todo}` (sorted, no duplicates). */
export type Use = { k: "Use"; path: string[]; names?: string[] } & Pos;
/** v0.5: `table todos: Todo key id`. */
export type Table = { k: "Table"; name: string; row: string; key: string; extern?: true } & Pos;
/** v0.5: the route of an `api fn`. `path` is the literal's text without quotes. */
export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}
export type RecordType = { k: "RecordType"; name: string; params: string[]; fields: [string, TypeExpr][]; extern?: true } & Pos;
export type Variant = [string, [string, TypeExpr][]];
export type SumType = { k: "SumType"; name: string; params: string[]; variants: Variant[]; extern?: true } & Pos;
export type Fn = {
  k: "Fn";
  name: string;
  tparams: string[];
  params: [string, TypeExpr][];
  ret: TypeExpr;
  effects: string[];
  requires: Expr | null;
  ensures: Expr | null;
  body: Stmt[];
  /** v0.5: set for an `api fn`. */
  route?: Route;
  /**
   * v0.5: an item imported from another module of the project, present only so this module can
   * be checked. Checkers skip it (it was checked in its own module) and printers omit it.
   */
  extern?: true;
} & Pos;
/** v0.3: `effects` lists the real effects (fs, net) a test may use; io, time and rand are virtual. */
export type Test = { k: "Test"; name: string; effects: string[]; body: Stmt[] } & Pos;
export type Item = Comment | Use | RecordType | SumType | Fn | Test | Table;

/** v0.5: true for an item imported from another module (see Fn.extern). */
export function isExtern(it: Item): boolean {
  return "extern" in it && it.extern === true;
}

export interface Program {
  k: "Program";
  items: Item[];
}

/** Node kinds that are statements (walk_exprs skips yielding these). */
export const STMT_KINDS = new Set(["Let", "Set", "Return", "If", "ForIn", "ForWhile", "ExprStmt", "Comment", "Break"]);

/**
 * Child fields of each node kind, in dataclass declaration order, so traversals
 * visit nodes in exactly the order the oracle does.
 */
export const FIELDS: Record<string, string[]> = {
  TName: ["args"], TFn: ["params", "ret"], TTuple: ["items"],
  Int: [], Float: [], Str: [], Bool: [], Name: [], Ctor: [],
  Call: ["callee", "args"], FieldGet: ["obj"], Binary: ["left", "right"], Unary: ["operand"],
  Lambda: ["body"], ListLit: ["items"], TupleLit: ["items"], Record: ["fields"],
  Match: ["subject", "arms"], Hole: [], Try: ["expr"],
  PWild: [], PBind: [], PLit: ["lit"], PCtor: ["args"], PTuple: ["items"],
  Comment: [], Let: ["value"], Set: ["target", "value"], Return: ["value"],
  If: ["cond", "body", "orelse"], ForIn: ["iterable", "body"], ForWhile: ["cond", "body"],
  ExprStmt: ["expr"], Break: [],
};

/** Yield every expression-or-pattern node under a value, in the oracle's walk_exprs order. */
export function* walkExprs(node: unknown): Generator<any> {
  if (Array.isArray(node)) {
    for (const x of node) yield* walkExprs(x);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const n = node as { k?: string };
  if (typeof n.k !== "string" || !(n.k in FIELDS)) return;
  if (!STMT_KINDS.has(n.k)) yield n;
  for (const f of FIELDS[n.k]) yield* walkExprs((n as any)[f]);
}

/** Every statement in a body, recursing into if/else and loops (oracle walk_stmts). */
export function* walkStmts(stmts: Stmt[]): Generator<Stmt> {
  for (const s of stmts) {
    yield s;
    if (s.k === "If") {
      yield* walkStmts(s.body);
      if (s.orelse) yield* walkStmts(s.orelse);
    } else if (s.k === "ForIn" || s.k === "ForWhile") {
      yield* walkStmts(s.body);
    }
  }
}
