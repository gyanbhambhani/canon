#!/usr/bin/env python3
"""Canon v0 reference front end.

Lexer, lenient parser, normalizer, canonical printer, and checker.

The central rule: a source file is accepted only if it equals the canonical
printing of its own syntax tree. The parser is deliberately lenient (any
whitespace, redundant parentheses, optional commas, pipelines or nested calls)
so that every surface variant maps to one tree, and the printer maps that tree
to exactly one text. "Accepted" therefore means "is a fixed point of fmt".

Usage:
    python canon.py check FILE      JSON diagnostics (exit 1 on errors)
    python canon.py fmt FILE        print the canonical form
"""
from __future__ import annotations

import difflib
import json
import re
import sys
from dataclasses import dataclass, field, replace
from typing import Optional

# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------


@dataclass
class Diagnostic:
    code: str
    severity: str  # error | warning | info
    message: str
    line: int = 0
    col: int = 0
    fix: Optional[dict] = None
    data: Optional[dict] = None

    def to_json(self) -> dict:
        d = {"code": self.code, "severity": self.severity, "message": self.message,
             "line": self.line, "col": self.col}
        if self.fix is not None:
            d["fix"] = self.fix
        if self.data is not None:
            d["data"] = self.data
        return d


class CanonError(Exception):
    def __init__(self, diag: Diagnostic):
        super().__init__(diag.message)
        self.diag = diag


# ---------------------------------------------------------------------------
# Lexer
# ---------------------------------------------------------------------------

KEYWORDS = {
    "fn", "type", "let", "var", "set", "if", "else", "match", "for", "in",
    "return", "use", "effects", "requires", "ensures", "true", "false", "test",
    "and", "or", "not", "try",
}
OPS = ["|>", "->", "=>", "==", "!=", "<=", ">=", "+", "-", "*", "/", "%", "<",
       ">", "=", "(", ")", "[", "]", "{", "}", ",", ":", ".", "|"]


@dataclass
class Tok:
    kind: str  # name tname int float str kw op comment hole eof
    text: str
    line: int
    col: int


NUM_RE = re.compile(r"\d+(\.\d+)?([eE][+-]?\d+)?")
NAME_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def lex(src: str) -> list[Tok]:
    toks: list[Tok] = []
    i, line, col = 0, 1, 1
    n = len(src)

    def err(msg):
        raise CanonError(Diagnostic("P001", "error", msg, line, col))

    while i < n:
        c = src[i]
        if c == "\n":
            i += 1
            line += 1
            col = 1
            continue
        if c in " \t\r":
            i += 1
            col += 1
            continue
        if c == "#":
            j = src.find("\n", i)
            j = n if j == -1 else j
            toks.append(Tok("comment", src[i:j].rstrip(), line, col))
            col += j - i
            i = j
            continue
        if c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                if src[j] == "\\":
                    j += 1
                if j < n and src[j] == "\n":
                    err("string literal crosses a line break")
                j += 1
            if j >= n:
                err("unterminated string literal")
            toks.append(Tok("str", src[i:j + 1], line, col))
            col += j + 1 - i
            i = j + 1
            continue
        if c == "'":
            err("single-quoted strings do not exist in Canon; use double quotes")
        if c == "?":
            m = NAME_RE.match(src, i + 1)
            text = "?" + (m.group(0) if m else "")
            toks.append(Tok("hole", text, line, col))
            col += len(text)
            i += len(text)
            continue
        if c.isdigit():
            m = NUM_RE.match(src, i)
            text = m.group(0)
            kind = "float" if ("." in text or "e" in text or "E" in text) else "int"
            toks.append(Tok(kind, text, line, col))
            col += len(text)
            i += len(text)
            continue
        if c.isalpha() or c == "_":
            m = NAME_RE.match(src, i)
            text = m.group(0)
            if text in KEYWORDS:
                kind = "kw"
            elif text[0].isupper():
                kind = "tname"
            else:
                kind = "name"
            toks.append(Tok(kind, text, line, col))
            col += len(text)
            i += len(text)
            continue
        for op in OPS:
            if src.startswith(op, i):
                toks.append(Tok("op", op, line, col))
                col += len(op)
                i += len(op)
                break
        else:
            err(f"unexpected character {c!r}")
    toks.append(Tok("eof", "", line, col))
    return toks


# ---------------------------------------------------------------------------
# AST
# ---------------------------------------------------------------------------

@dataclass
class Node:
    line: int = field(default=0, compare=False, kw_only=True)
    col: int = field(default=0, compare=False, kw_only=True)


# types
@dataclass
class TName(Node):
    name: str
    args: list = field(default_factory=list)


@dataclass
class TFn(Node):
    params: list
    ret: object


@dataclass
class TTuple(Node):
    items: list


# expressions
@dataclass
class Int(Node):
    value: int


@dataclass
class Float(Node):
    value: float


@dataclass
class Str(Node):
    raw: str  # including quotes, escapes preserved


@dataclass
class Bool(Node):
    value: bool


@dataclass
class Name(Node):
    path: list  # ["http", "get"] or ["x"]


@dataclass
class Ctor(Node):
    name: str


@dataclass
class Call(Node):
    callee: object  # Name or Ctor
    args: list


@dataclass
class FieldGet(Node):
    obj: object
    name: str


@dataclass
class Binary(Node):
    op: str
    left: object
    right: object


@dataclass
class Unary(Node):
    op: str  # "-" | "not"
    operand: object


@dataclass
class Lambda(Node):
    params: list
    body: object


@dataclass
class ListLit(Node):
    items: list


@dataclass
class TupleLit(Node):
    items: list


@dataclass
class Record(Node):
    tname: str
    fields: list  # [(name, expr)]


@dataclass
class Match(Node):
    subject: object
    arms: list  # [(pattern, expr)]


@dataclass
class Hole(Node):
    name: str


@dataclass
class Try(Node):
    expr: object


# patterns
@dataclass
class PWild(Node):
    pass


@dataclass
class PBind(Node):
    name: str


@dataclass
class PLit(Node):
    lit: object


@dataclass
class PCtor(Node):
    name: str
    args: list


@dataclass
class PTuple(Node):
    items: list


# statements
@dataclass
class Comment(Node):
    text: str


@dataclass
class Let(Node):
    name: str
    value: object
    mutable: bool = False


@dataclass
class Set(Node):
    target: object
    value: object


@dataclass
class Return(Node):
    value: Optional[object]


@dataclass
class If(Node):
    cond: object
    body: list
    orelse: Optional[list]


@dataclass
class ForIn(Node):
    var: str
    iterable: object
    body: list


@dataclass
class ForWhile(Node):
    cond: object
    body: list


@dataclass
class ExprStmt(Node):
    expr: object


# items
@dataclass
class Use(Node):
    path: list


@dataclass
class RecordType(Node):
    name: str
    params: list
    fields: list  # [(name, type)]


@dataclass
class SumType(Node):
    name: str
    params: list
    variants: list  # [(name, [(fname, type)])]


@dataclass
class Fn(Node):
    name: str
    tparams: list
    params: list  # [(name, type)]
    ret: object
    effects: list
    requires: Optional[object]
    ensures: Optional[object]
    body: list


@dataclass
class Test(Node):
    name: str  # raw string literal
    body: list


@dataclass
class Program(Node):
    items: list


# ---------------------------------------------------------------------------
# Parser (lenient: whitespace, parens, commas, pipeline-vs-call are free)
# ---------------------------------------------------------------------------

class Parser:
    def __init__(self, toks: list[Tok]):
        self.toks = toks
        self.i = 0

    # helpers
    @property
    def tok(self) -> Tok:
        return self.toks[self.i]

    def peek(self, k=1) -> Tok:
        return self.toks[min(self.i + k, len(self.toks) - 1)]

    def at(self, kind, text=None) -> bool:
        t = self.tok
        return t.kind == kind and (text is None or t.text == text)

    def at_op(self, text) -> bool:
        return self.at("op", text)

    def at_kw(self, text) -> bool:
        return self.at("kw", text)

    def advance(self) -> Tok:
        t = self.tok
        self.i += 1
        return t

    def error(self, expected: str):
        t = self.tok
        found = "end of file" if t.kind == "eof" else repr(t.text)
        raise CanonError(Diagnostic("P001", "error", f"expected {expected}, found {found}",
                                    t.line, t.col))

    def expect(self, kind, text=None, what=None) -> Tok:
        if not self.at(kind, text):
            self.error(what or (repr(text) if text else kind))
        return self.advance()

    def eat_op(self, text) -> bool:
        if self.at_op(text):
            self.advance()
            return True
        return False

    def pos(self, t: Tok) -> dict:
        return {"line": t.line, "col": t.col}

    def no_comment(self):
        if self.at("comment"):
            t = self.tok
            raise CanonError(Diagnostic(
                "P002", "error", "comments must sit on their own line between statements",
                t.line, t.col))

    # program
    def program(self) -> Program:
        items = []
        while not self.at("eof"):
            items.append(self.item())
        return Program(items)

    def item(self):
        t = self.tok
        if t.kind == "comment":
            self.advance()
            return Comment(t.text, **self.pos(t))
        if self.at_kw("use"):
            self.advance()
            path = [self.expect("name", what="module name").text]
            while self.eat_op("."):
                path.append(self.expect("name", what="module name").text)
            return Use(path, **self.pos(t))
        if self.at_kw("type"):
            return self.type_decl()
        if self.at_kw("fn"):
            return self.fn_decl()
        if self.at_kw("test"):
            self.advance()
            name = self.expect("str", what="test name string").text
            return Test(name, self.block(), **self.pos(t))
        self.error("'use', 'type', 'fn', or 'test' at top level")

    def tparams(self) -> list:
        ps = []
        if self.eat_op("["):
            ps.append(self.expect("tname", what="type parameter").text)
            while self.eat_op(","):
                if self.at_op("]"):
                    break
                ps.append(self.expect("tname", what="type parameter").text)
            self.expect("op", "]")
        return ps

    def type_decl(self):
        t = self.advance()
        name = self.expect("tname", what="type name").text
        params = self.tparams()
        if self.eat_op("{"):
            fields = []
            while not self.at_op("}"):
                self.no_comment()
                fname = self.expect("name", what="field name").text
                self.expect("op", ":")
                fields.append((fname, self.type_expr()))
                self.eat_op(",")
            self.expect("op", "}")
            return RecordType(name, params, fields, **self.pos(t))
        self.expect("op", "=", what="'{' or '='")
        self.eat_op("|")
        variants = [self.variant()]
        while self.eat_op("|"):
            variants.append(self.variant())
        return SumType(name, params, variants, **self.pos(t))

    def variant(self):
        name = self.expect("tname", what="variant name").text
        fields = []
        if self.eat_op("("):
            while not self.at_op(")"):
                fname = self.expect("name", what="field name").text
                self.expect("op", ":")
                fields.append((fname, self.type_expr()))
                if not self.eat_op(","):
                    break
            self.expect("op", ")")
        return (name, fields)

    def type_expr(self):
        t = self.tok
        if self.at_kw("fn"):
            self.advance()
            self.expect("op", "(")
            ps = []
            while not self.at_op(")"):
                ps.append(self.type_expr())
                if not self.eat_op(","):
                    break
            self.expect("op", ")")
            self.expect("op", "->")
            return TFn(ps, self.type_expr(), **self.pos(t))
        if self.eat_op("("):
            items = [self.type_expr()]
            while self.eat_op(","):
                if self.at_op(")"):
                    break
                items.append(self.type_expr())
            self.expect("op", ")")
            if len(items) == 1:
                return items[0]
            return TTuple(items, **self.pos(t))
        name = self.expect("tname", what="a type").text
        args = []
        if self.eat_op("["):
            args.append(self.type_expr())
            while self.eat_op(","):
                if self.at_op("]"):
                    break
                args.append(self.type_expr())
            self.expect("op", "]")
        return TName(name, args, **self.pos(t))

    def fn_decl(self):
        t = self.advance()
        name_tok = self.expect("name", what="function name")
        tparams = self.tparams()
        self.expect("op", "(")
        params = []
        while not self.at_op(")"):
            pname = self.expect("name", what="parameter name").text
            self.expect("op", ":")
            params.append((pname, self.type_expr()))
            if not self.eat_op(","):
                break
        self.expect("op", ")")
        self.expect("op", "->", what="'->' and a return type (return types are required)")
        ret = self.type_expr()
        effects, requires, ensures = [], None, None
        while self.at_kw("effects") or self.at_kw("requires") or self.at_kw("ensures"):
            kw = self.advance().text
            self.expect("op", ":")
            if kw == "effects":
                effects.append(self.expect("name", what="effect name").text)
                while self.eat_op(","):
                    effects.append(self.expect("name", what="effect name").text)
            else:
                e = self.expr(no_struct=True)
                if kw == "requires":
                    requires = e if requires is None else Binary("and", requires, e)
                else:
                    ensures = e if ensures is None else Binary("and", ensures, e)
        body = self.block()
        return Fn(name_tok.text, tparams, params, ret, effects, requires, ensures, body,
                  **self.pos(name_tok))

    # statements
    def block(self) -> list:
        self.expect("op", "{")
        stmts = []
        while not self.at_op("}"):
            if self.at("eof"):
                self.error("'}'")
            stmts.append(self.stmt())
        self.advance()
        return stmts

    def stmt(self):
        t = self.tok
        p = self.pos(t)
        if t.kind == "comment":
            self.advance()
            return Comment(t.text, **p)
        if self.at_kw("let") or self.at_kw("var"):
            mutable = self.advance().text == "var"
            name = self.expect("name", what="binding name").text
            if self.at_op(":"):
                raise CanonError(Diagnostic(
                    "P003", "error",
                    "local bindings never carry type annotations; types live on signatures",
                    self.tok.line, self.tok.col))
            self.expect("op", "=")
            return Let(name, self.expr(stmt=True), mutable, **p)
        if self.at_kw("set"):
            self.advance()
            target = self.postfix(self.primary())
            self.expect("op", "=")
            return Set(target, self.expr(stmt=True), **p)
        if self.at_kw("return"):
            self.advance()
            if self.at_op("}"):
                return Return(None, **p)
            return Return(self.expr(stmt=True), **p)
        if self.at_kw("if"):
            return self.if_stmt()
        if self.at_kw("for"):
            self.advance()
            if self.at("name") and self.peek().kind == "kw" and self.peek().text == "in":
                var = self.advance().text
                self.advance()
                it = self.expr(no_struct=True)
                return ForIn(var, it, self.block(), **p)
            cond = self.expr(no_struct=True)
            return ForWhile(cond, self.block(), **p)
        e = self.expr(stmt=True)
        inner = e.expr if isinstance(e, Try) else e
        if not isinstance(inner, Call):
            raise CanonError(Diagnostic(
                "P004", "error",
                "an expression statement must be a function call; bind other values with let",
                t.line, t.col))
        return ExprStmt(e, **p)

    def if_stmt(self):
        t = self.advance()
        cond = self.expr(no_struct=True)
        body = self.block()
        orelse = None
        if self.at_kw("else"):
            self.advance()
            if self.at_kw("if"):
                orelse = [self.if_stmt()]
            else:
                orelse = self.block()
        return If(cond, body, orelse, **self.pos(t))

    # expressions
    def expr(self, no_struct=False, stmt=False):
        saved = getattr(self, "_ns", False)
        self._ns = no_struct
        try:
            return self.pipe()
        finally:
            self._ns = saved

    def pipe(self):
        left = self.or_expr()
        while self.at_op("|>"):
            t = self.advance()
            stage = self.postfix(self.primary())
            if not isinstance(stage, Call):
                raise CanonError(Diagnostic(
                    "P005", "error", "each pipeline stage must be a call, like '|> f()'",
                    t.line, t.col))
            left = Call(stage.callee, [left] + stage.args, line=stage.line, col=stage.col)
        return left

    def or_expr(self):
        left = self.and_expr()
        while self.at_kw("or"):
            self.advance()
            left = Binary("or", left, self.and_expr())
        return left

    def and_expr(self):
        left = self.not_expr()
        while self.at_kw("and"):
            self.advance()
            left = Binary("and", left, self.not_expr())
        return left

    def not_expr(self):
        if self.at_kw("not"):
            t = self.advance()
            return Unary("not", self.not_expr(), **self.pos(t))
        return self.cmp_expr()

    def cmp_expr(self):
        left = self.add_expr()
        if self.tok.kind == "op" and self.tok.text in ("==", "!=", "<", "<=", ">", ">="):
            op = self.advance().text
            right = self.add_expr()
            if self.tok.kind == "op" and self.tok.text in ("==", "!=", "<", "<=", ">", ">="):
                self.error("end of comparison (comparisons do not chain; use 'and')")
            return Binary(op, left, right)
        return left

    def add_expr(self):
        left = self.mul_expr()
        while self.tok.kind == "op" and self.tok.text in ("+", "-"):
            op = self.advance().text
            left = Binary(op, left, self.mul_expr())
        return left

    def mul_expr(self):
        left = self.unary()
        while self.tok.kind == "op" and self.tok.text in ("*", "/", "%"):
            op = self.advance().text
            left = Binary(op, left, self.unary())
        return left

    def unary(self):
        if self.at_op("-"):
            t = self.advance()
            return Unary("-", self.unary(), **self.pos(t))
        if self.at_kw("try"):
            t = self.advance()
            return Try(self.unary(), **self.pos(t))
        return self.postfix(self.primary())

    def postfix(self, e):
        while True:
            # A call's '(' must be on the callee's line; a '(' on a new line starts
            # a new statement. This is the only place where a line break matters.
            if self.at_op("(") and self.tok.line == self.toks[self.i - 1].line:
                if not isinstance(e, (Name, Ctor)):
                    self.error("a named function before '(' (only named functions are called)")
                self.advance()
                args = self.args_until(")")
                e = Call(e, args, line=e.line, col=e.col)
            elif self.at_op("."):
                self.advance()
                t = self.tok
                if t.kind in ("name", "int"):
                    self.advance()
                    if isinstance(e, Name) and t.kind == "name" and not self.at_op(".") \
                            and self.at_op("("):
                        e = Name(e.path + [t.text], line=e.line, col=e.col)
                    else:
                        e = FieldGet(e, t.text, line=e.line, col=e.col)
                else:
                    self.error("field name after '.'")
            else:
                return e

    def args_until(self, close) -> list:
        args = []
        saved = self._ns
        self._ns = False
        while not self.at_op(close):
            args.append(self.expr())
            if not self.eat_op(","):
                break
        self._ns = saved
        self.expect("op", close)
        return args

    def primary(self):
        t = self.tok
        p = self.pos(t)
        if t.kind == "int":
            self.advance()
            return Int(int(t.text), **p)
        if t.kind == "float":
            self.advance()
            return Float(float(t.text), **p)
        if t.kind == "str":
            self.advance()
            return Str(t.text, **p)
        if t.kind == "hole":
            self.advance()
            return Hole(t.text[1:], **p)
        if self.at_kw("true") or self.at_kw("false"):
            self.advance()
            return Bool(t.text == "true", **p)
        if t.kind == "name":
            self.advance()
            return Name([t.text], **p)
        if t.kind == "tname":
            self.advance()
            if self.at_op("{") and not self._ns:
                self.advance()
                fields = []
                saved = self._ns
                self._ns = False
                while not self.at_op("}"):
                    fname = self.expect("name", what="field name").text
                    self.expect("op", ":")
                    fields.append((fname, self.expr()))
                    if not self.eat_op(","):
                        break
                self._ns = saved
                self.expect("op", "}")
                return Record(t.text, fields, **p)
            return Ctor(t.text, **p)
        if self.at_op("("):
            self.advance()
            saved = self._ns
            self._ns = False
            first = self.expr()
            if self.eat_op(","):
                items = [first]
                while not self.at_op(")"):
                    items.append(self.expr())
                    if not self.eat_op(","):
                        break
                self._ns = saved
                self.expect("op", ")")
                return TupleLit(items, **p)
            self._ns = saved
            self.expect("op", ")")
            return first
        if self.at_op("["):
            self.advance()
            return ListLit(self.args_until("]"), **p)
        if self.at_op("|"):
            self.advance()
            params = []
            while not self.at_op("|"):
                params.append(self.expect("name", what="lambda parameter").text)
                if not self.eat_op(","):
                    break
            self.expect("op", "|")
            saved = self._ns
            self._ns = False
            body = self.or_expr()
            self._ns = saved
            return Lambda(params, body, **p)
        if self.at_kw("match"):
            self.advance()
            subject = self.expr(no_struct=True)
            self.expect("op", "{")
            arms = []
            saved = self._ns
            self._ns = False
            while not self.at_op("}"):
                self.no_comment()
                pat = self.pattern()
                self.expect("op", "=>")
                arms.append((pat, self.expr()))
                self.eat_op(",")
            self._ns = saved
            self.expect("op", "}")
            return Match(subject, arms, **p)
        self.error("an expression")

    def pattern(self):
        t = self.tok
        p = self.pos(t)
        if t.kind == "name":
            self.advance()
            return PWild(**p) if t.text == "_" else PBind(t.text, **p)
        if t.kind in ("int", "float", "str") or self.at_kw("true") or self.at_kw("false") \
                or self.at_op("-"):
            return PLit(self.unary(), **p)
        if t.kind == "tname":
            self.advance()
            args = []
            if self.eat_op("("):
                while not self.at_op(")"):
                    args.append(self.pattern())
                    if not self.eat_op(","):
                        break
                self.expect("op", ")")
            return PCtor(t.text, args, **p)
        if self.eat_op("("):
            items = [self.pattern()]
            while self.eat_op(","):
                items.append(self.pattern())
            self.expect("op", ")")
            return PTuple(items, **p)
        self.error("a pattern")


def parse(src: str) -> Program:
    p = Parser(lex(src))
    p._ns = False
    return p.program()


# ---------------------------------------------------------------------------
# Normalizer: semantic no-ops an agent tends to write, collapsed to one form
# ---------------------------------------------------------------------------

def normalize_expr(e):
    if isinstance(e, Binary):
        l, r = normalize_expr(e.left), normalize_expr(e.right)
        # x == true -> x ; x == false -> not x ; x != true -> not x ; x != false -> x
        if e.op in ("==", "!=") and (isinstance(r, Bool) or isinstance(l, Bool)):
            b, other = (r, l) if isinstance(r, Bool) else (l, r)
            positive = (e.op == "==") == b.value
            return other if positive else Unary("not", other)
        return Binary(e.op, l, r, line=e.line, col=e.col)
    if isinstance(e, Unary):
        inner = normalize_expr(e.operand)
        if e.op == "not" and isinstance(inner, Unary) and inner.op == "not":
            return inner.operand
        return Unary(e.op, inner, line=e.line, col=e.col)
    if isinstance(e, Call):
        return replace(e, args=[normalize_expr(a) for a in e.args])
    if isinstance(e, FieldGet):
        return replace(e, obj=normalize_expr(e.obj))
    if isinstance(e, Lambda):
        return replace(e, body=normalize_expr(e.body))
    if isinstance(e, ListLit):
        return replace(e, items=[normalize_expr(a) for a in e.items])
    if isinstance(e, TupleLit):
        return replace(e, items=[normalize_expr(a) for a in e.items])
    if isinstance(e, Record):
        return replace(e, fields=[(n, normalize_expr(v)) for n, v in e.fields])
    if isinstance(e, Match):
        return replace(e, subject=normalize_expr(e.subject),
                       arms=[(p, normalize_expr(v)) for p, v in e.arms])
    if isinstance(e, Try):
        return replace(e, expr=normalize_expr(e.expr))
    return e


def normalize_stmts(stmts):
    out = []
    for s in stmts:
        if isinstance(s, Let):
            s = replace(s, value=normalize_expr(s.value))
        elif isinstance(s, Set):
            s = replace(s, value=normalize_expr(s.value))
        elif isinstance(s, Return) and s.value is not None:
            s = replace(s, value=normalize_expr(s.value))
        elif isinstance(s, ExprStmt):
            s = replace(s, expr=normalize_expr(s.expr))
        elif isinstance(s, If):
            s = replace(s, cond=normalize_expr(s.cond), body=normalize_stmts(s.body),
                        orelse=None if s.orelse is None else normalize_stmts(s.orelse))
        elif isinstance(s, ForIn):
            s = replace(s, iterable=normalize_expr(s.iterable), body=normalize_stmts(s.body))
        elif isinstance(s, ForWhile):
            s = replace(s, cond=normalize_expr(s.cond), body=normalize_stmts(s.body))
        out.append(s)
    return out


def normalize(prog: Program) -> Program:
    items = []
    for it in prog.items:
        if isinstance(it, Fn):
            it = replace(it,
                         effects=sorted(set(it.effects)),
                         requires=None if it.requires is None else normalize_expr(it.requires),
                         ensures=None if it.ensures is None else normalize_expr(it.ensures),
                         body=normalize_stmts(it.body))
        elif isinstance(it, Test):
            it = replace(it, body=normalize_stmts(it.body))
        items.append(it)
    uses = sorted((u for u in items if isinstance(u, Use)), key=lambda u: u.path)
    # dedupe identical imports
    deduped = []
    for u in uses:
        if not deduped or deduped[-1].path != u.path:
            deduped.append(u)
    rest = [it for it in items if not isinstance(it, Use)]
    return Program(deduped + rest)


# ---------------------------------------------------------------------------
# Canonical printer
# ---------------------------------------------------------------------------

PREC = {"pipe": 0, "or": 1, "and": 2, "not": 3, "==": 4, "!=": 4, "<": 4, "<=": 4,
        ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, "unary": 7,
        "postfix": 8, "atom": 9}
PIPELINE_MIN_STAGES = 3
INDENT = "  "
MAX_LINE = 100


def is_scalar_literal(e) -> bool:
    if isinstance(e, Unary) and e.op == "-":
        return is_scalar_literal(e.operand)
    return isinstance(e, (Int, Float, Str, Bool))


def chain_eligible(e) -> bool:
    """A call that can be a pipeline stage: a lowercase function with >= 1 argument
    whose first argument is not a scalar literal (literals never flow down a pipe,
    so range(0, n) stays a call and never becomes 0 |> range(n))."""
    return (isinstance(e, Call) and isinstance(e.callee, Name) and len(e.args) >= 1
            and not is_scalar_literal(e.args[0]))


def unroll_chain(e):
    stages = []
    cur = e
    while chain_eligible(cur):
        stages.append(cur)
        cur = cur.args[0]
    return cur, list(reversed(stages))


def float_text(v: float) -> str:
    t = repr(v)
    if t in ("inf", "nan", "-inf"):
        raise ValueError(t)
    return t


class Printer:
    def __init__(self, noise=None):
        # noise: an optional random.Random used by tests to emit equivalent
        # non-canonical variants (extra parens, pipelines vs calls, commas).
        self.noise = noise

    def coin(self, p=0.5) -> bool:
        return self.noise is not None and self.noise.random() < p

    # types
    def ty(self, t) -> str:
        if isinstance(t, TName):
            return t.name + (f"[{', '.join(self.ty(a) for a in t.args)}]" if t.args else "")
        if isinstance(t, TFn):
            return f"fn({', '.join(self.ty(p) for p in t.params)}) -> {self.ty(t.ret)}"
        if isinstance(t, TTuple):
            return f"({', '.join(self.ty(i) for i in t.items)})"
        raise TypeError(t)

    # expressions
    def prec_of(self, e) -> int:
        if isinstance(e, Binary):
            return PREC[e.op]
        if isinstance(e, Unary):
            return PREC["not"] if e.op == "not" else PREC["unary"]
        if isinstance(e, Try):
            return PREC["unary"]
        if isinstance(e, Lambda):
            return PREC["pipe"]
        if isinstance(e, Call):
            head, stages = unroll_chain(e)
            if len(stages) >= PIPELINE_MIN_STAGES:
                return PREC["pipe"]
            return PREC["postfix"]
        if isinstance(e, FieldGet):
            return PREC["postfix"]
        return PREC["atom"]

    def ex(self, e, min_prec=0, indent="", stmt=False) -> str:
        noisy_pipe = None
        if self.noise is not None and isinstance(e, Call) and chain_eligible(e):
            noisy_pipe = self.coin(0.5)
        s, p = self._ex(e, indent, stmt, noisy_pipe)
        if p < min_prec:
            return f"({s})"
        if self.noise is not None and p < PREC["atom"] and not stmt and self.coin(0.25):
            return f"({s})"
        return s

    def _ex(self, e, indent, stmt, noisy_pipe):
        if isinstance(e, Int):
            return str(e.value), PREC["atom"]
        if isinstance(e, Float):
            return float_text(e.value), PREC["atom"]
        if isinstance(e, Str):
            return e.raw, PREC["atom"]
        if isinstance(e, Bool):
            return ("true" if e.value else "false"), PREC["atom"]
        if isinstance(e, Name):
            return ".".join(e.path), PREC["atom"]
        if isinstance(e, Ctor):
            return e.name, PREC["atom"]
        if isinstance(e, Hole):
            return "?" + e.name, PREC["atom"]
        if isinstance(e, Binary):
            p = PREC[e.op]
            if p == 4:  # comparisons do not associate
                l = self.ex(e.left, p + 1, indent)
                r = self.ex(e.right, p + 1, indent)
            else:
                l = self.ex(e.left, p, indent)
                r = self.ex(e.right, p + 1, indent)
            return f"{l} {e.op} {r}", p
        if isinstance(e, Unary):
            if e.op == "not":
                return f"not {self.ex(e.operand, PREC['not'], indent)}", PREC["not"]
            return f"-{self.ex(e.operand, PREC['unary'], indent)}", PREC["unary"]
        if isinstance(e, Try):
            return f"try {self.ex(e.expr, PREC['unary'], indent)}", PREC["unary"]
        if isinstance(e, FieldGet):
            return f"{self.ex(e.obj, PREC['postfix'], indent)}.{e.name}", PREC["postfix"]
        if isinstance(e, Lambda):
            return f"|{', '.join(e.params)}| {self.ex(e.body, 1, indent)}", PREC["pipe"]
        if isinstance(e, ListLit):
            return f"[{self.items(e.items, indent)}]", PREC["atom"]
        if isinstance(e, TupleLit):
            return f"({self.items(e.items, indent)})", PREC["atom"]
        if isinstance(e, Record):
            inner = ", ".join(f"{n}: {self.ex(v, 0, indent)}" for n, v in e.fields)
            return (f"{e.tname} {{ {inner} }}" if inner else f"{e.tname} {{}}"), PREC["atom"]
        if isinstance(e, Match):
            if not stmt:
                raise CanonError(Diagnostic(
                    "S001", "error",
                    "match is only allowed as a whole statement value (let, set, return); "
                    "bind it with let first", e.line, e.col))
            lines = [f"match {self.ex(e.subject, 1, indent)} {{"]
            for pat, val in e.arms:
                lines.append(f"{indent}{INDENT}{self.pat(pat)} => {self.ex(val, 0, indent + INDENT)},")
            lines.append(f"{indent}}}")
            return "\n".join(lines), PREC["atom"]
        if isinstance(e, Call):
            head, stages = unroll_chain(e)
            use_pipe = len(stages) >= PIPELINE_MIN_STAGES
            if noisy_pipe is not None:
                use_pipe = noisy_pipe and len(stages) >= 1
            if use_pipe:
                head_s = self.ex(head, 1, indent)
                parts = []
                for st in stages:
                    callee = ".".join(st.callee.path)
                    parts.append(f"|> {callee}({self.items(st.args[1:], indent)})")
                if stmt and self.noise is None:
                    sep = "\n" + indent + INDENT
                    return head_s + sep + sep.join(parts), PREC["pipe"]
                return head_s + " " + " ".join(parts), PREC["pipe"]
            callee = self.ex(e.callee, PREC["postfix"], indent)
            return f"{callee}({self.items(e.args, indent)})", PREC["postfix"]
        raise TypeError(type(e).__name__)

    def items(self, xs, indent) -> str:
        s = ", ".join(self.ex(x, 0, indent) for x in xs)
        if xs and self.coin(0.2):
            s += ","
        return s

    def pat(self, p) -> str:
        if isinstance(p, PWild):
            return "_"
        if isinstance(p, PBind):
            return p.name
        if isinstance(p, PLit):
            return self.ex(p.lit, 0)
        if isinstance(p, PCtor):
            return p.name + (f"({', '.join(self.pat(a) for a in p.args)})" if p.args else "")
        if isinstance(p, PTuple):
            return f"({', '.join(self.pat(a) for a in p.items)})"
        raise TypeError(p)

    # statements
    def block(self, stmts, indent) -> str:
        if not stmts:
            return "{}"
        inner = indent + INDENT
        lines = ["{"]
        for s in stmts:
            lines.append(self.stmt(s, inner))
        lines.append(indent + "}")
        return "\n".join(lines)

    def stmt(self, s, indent) -> str:
        if isinstance(s, Comment):
            return indent + s.text
        if isinstance(s, Let):
            kw = "var" if s.mutable else "let"
            return f"{indent}{kw} {s.name} = {self.ex(s.value, 0, indent, stmt=True)}"
        if isinstance(s, Set):
            return f"{indent}set {self.ex(s.target, 0, indent)} = {self.ex(s.value, 0, indent, stmt=True)}"
        if isinstance(s, Return):
            if s.value is None:
                return indent + "return"
            return f"{indent}return {self.ex(s.value, 0, indent, stmt=True)}"
        if isinstance(s, ExprStmt):
            return indent + self.ex(s.expr, 0, indent, stmt=True)
        if isinstance(s, If):
            return indent + self.if_text(s, indent)
        if isinstance(s, ForIn):
            return f"{indent}for {s.var} in {self.ex(s.iterable, 1, indent)} {self.block(s.body, indent)}"
        if isinstance(s, ForWhile):
            return f"{indent}for {self.ex(s.cond, 1, indent)} {self.block(s.body, indent)}"
        raise TypeError(type(s).__name__)

    def if_text(self, s, indent) -> str:
        text = f"if {self.ex(s.cond, 1, indent)} {self.block(s.body, indent)}"
        if s.orelse is not None:
            if len(s.orelse) == 1 and isinstance(s.orelse[0], If) and not self.coin(0.3):
                text += " else " + self.if_text(s.orelse[0], indent)
            else:
                text += " else " + self.block(s.orelse, indent)
        return text

    # items
    def item(self, it) -> str:
        if isinstance(it, Comment):
            return it.text
        if isinstance(it, Use):
            return "use " + ".".join(it.path)
        if isinstance(it, RecordType):
            tp = f"[{', '.join(it.params)}]" if it.params else ""
            lines = [f"type {it.name}{tp} {{"]
            for n, t in it.fields:
                lines.append(f"{INDENT}{n}: {self.ty(t)},")
            lines.append("}")
            return "\n".join(lines)
        if isinstance(it, SumType):
            tp = f"[{', '.join(it.params)}]" if it.params else ""
            lines = [f"type {it.name}{tp} ="]
            for vn, fs in it.variants:
                args = f"({', '.join(f'{n}: {self.ty(t)}' for n, t in fs)})" if fs else ""
                lines.append(f"{INDENT}| {vn}{args}")
            return "\n".join(lines)
        if isinstance(it, Fn):
            tp = f"[{', '.join(it.tparams)}]" if it.tparams else ""
            params = ", ".join(f"{n}: {self.ty(t)}" for n, t in it.params)
            head = f"fn {it.name}{tp}({params}) -> {self.ty(it.ret)}"
            clauses = []
            if it.effects:
                clauses.append(f"{INDENT}effects: {', '.join(it.effects)}")
            if it.requires is not None:
                clauses.append(f"{INDENT}requires: {self.ex(it.requires, 1)}")
            if it.ensures is not None:
                clauses.append(f"{INDENT}ensures: {self.ex(it.ensures, 1)}")
            body = self.block(it.body, "")
            if clauses:
                return "\n".join([head] + clauses + [body])
            return f"{head} {body}"
        if isinstance(it, Test):
            return f"test {it.name} {self.block(it.body, '')}"
        raise TypeError(type(it).__name__)

    def program(self, prog: Program) -> str:
        out = []
        prev = None
        for it in prog.items:
            text = self.item(it)
            if prev is not None:
                tight = (isinstance(prev, Use) and isinstance(it, Use)) or isinstance(prev, Comment)
                out.append("\n" if tight else "\n\n")
            out.append(text)
            prev = it
        return "".join(out) + "\n" if out else ""


def fmt(src: str) -> str:
    return Printer().program(normalize(parse(src)))


# ---------------------------------------------------------------------------
# Checks: naming, effects, holes
# ---------------------------------------------------------------------------

SNAKE = re.compile(r"^[a-z_][a-z0-9_]*$")
PASCAL = re.compile(r"^[A-Z][A-Za-z0-9]*$")
EFFECTS = {"fs", "io", "net", "rand", "time"}
BUILTIN_EFFECTS = {
    "print": {"io"}, "read_line": {"io"},
    "read_file": {"fs"}, "write_file": {"fs"},
    "http_get": {"net"}, "http_post": {"net"},
    "now": {"time"}, "sleep": {"time"},
    "random": {"rand"},
}
PURE_BUILTINS = {
    "abs", "all", "any", "append", "assert", "concat", "contains", "enumerate", "filter",
    "first", "fold", "get", "group_by", "join", "keys", "last", "len", "map", "max", "min",
    "parse_float", "parse_int", "range", "reverse", "sort_by", "sort_desc_by", "split",
    "sum", "take", "to_string", "trim", "unwrap_or", "values", "zip",
}


def walk_exprs(node):
    """Yield every expression node under a statement list or expression."""
    if isinstance(node, list):
        for x in node:
            yield from walk_exprs(x)
        return
    if isinstance(node, tuple):
        for x in node:
            yield from walk_exprs(x)
        return
    if not isinstance(node, Node):
        return
    if not isinstance(node, (Let, Set, Return, If, ForIn, ForWhile, ExprStmt, Comment)):
        yield node
    for f in node.__dataclass_fields__:
        if f in ("line", "col"):
            continue
        yield from walk_exprs(getattr(node, f))


def check_names(prog: Program) -> list[Diagnostic]:
    diags = []

    def bad(kind, name, want, node):
        diags.append(Diagnostic("N001", "error", f"{kind} '{name}' must be {want}",
                                node.line, node.col))

    for it in prog.items:
        if isinstance(it, (RecordType, SumType)):
            if not PASCAL.match(it.name):
                bad("type", it.name, "PascalCase", it)
            if isinstance(it, RecordType):
                for n, _ in it.fields:
                    if not SNAKE.match(n):
                        bad("field", n, "snake_case", it)
            else:
                for vn, fs in it.variants:
                    if not PASCAL.match(vn):
                        bad("variant", vn, "PascalCase", it)
        if isinstance(it, Fn):
            if not SNAKE.match(it.name):
                bad("function", it.name, "snake_case", it)
            for n, _ in it.params:
                if not SNAKE.match(n):
                    bad("parameter", n, "snake_case", it)
            for e in it.effects:
                if e not in EFFECTS:
                    diags.append(Diagnostic(
                        "E100", "error",
                        f"unknown effect '{e}'; the effects are {', '.join(sorted(EFFECTS))}",
                        it.line, it.col))
        if isinstance(it, (Fn, Test)):
            for s in walk_stmts(it.body):
                if isinstance(s, Let) and not SNAKE.match(s.name):
                    bad("binding", s.name, "snake_case", s)
    return diags


def walk_stmts(stmts):
    for s in stmts:
        yield s
        if isinstance(s, If):
            yield from walk_stmts(s.body)
            if s.orelse:
                yield from walk_stmts(s.orelse)
        elif isinstance(s, (ForIn, ForWhile)):
            yield from walk_stmts(s.body)


def program_text(prog: Program) -> str:
    return Printer().program(prog)


def patch(before: str, after: str, path: str) -> dict:
    rel = path.lstrip("/")
    diff = "".join(difflib.unified_diff(before.splitlines(True), after.splitlines(True),
                                        f"a/{rel}", f"b/{rel}"))
    return {"kind": "patch", "diff": diff}


def check_effects(prog: Program, src: str, path: str) -> list[Diagnostic]:
    """Effect lists are exact. Patches are relative to the original source, so one
    patch also fixes any formatting drift."""
    diags = []
    user = {it.name: set(it.effects) for it in prog.items if isinstance(it, Fn)}
    for idx, it in enumerate(prog.items):
        if not isinstance(it, Fn):
            continue
        used: dict[str, str] = {}
        all_known = True
        for e in walk_exprs(it.body):
            if not isinstance(e, Call) or not isinstance(e.callee, Name):
                continue
            if len(e.callee.path) != 1:
                all_known = False  # imported module function: effects unknown in v0
                continue
            name = e.callee.path[0]
            if name in BUILTIN_EFFECTS:
                effs = BUILTIN_EFFECTS[name]
            elif name in user:
                effs = user[name]
            elif name in PURE_BUILTINS:
                effs = set()
            else:
                all_known = False
                effs = set()
            for ef in effs:
                used.setdefault(ef, name)
        declared = set(it.effects)
        missing = sorted(set(used) - declared)
        extra = sorted(declared - set(used)) if all_known else []
        if missing or extra:
            fixed_items = list(prog.items)
            new_effects = sorted(set(used) | (declared if not all_known else set()))
            fixed_items[idx] = replace(it, effects=new_effects)
            fix = patch(src, program_text(Program(fixed_items)), path)
        if missing:
            via = ", ".join(f"{m} (via {used[m]})" for m in missing)
            diags.append(Diagnostic(
                "E101", "error",
                f"fn {it.name} uses effects it does not declare: {via}",
                it.line, it.col, fix=fix, data={"missing": missing}))
        if extra:
            diags.append(Diagnostic(
                "E102", "error",
                f"fn {it.name} declares effects it never uses: {', '.join(extra)} "
                "(effect lists are exact)",
                it.line, it.col, fix=fix, data={"unused": extra}))
    return diags


def check_holes(prog: Program) -> list[Diagnostic]:
    diags = []
    fns = {it.name: it for it in prog.items if isinstance(it, Fn)}
    printer = Printer()

    def candidates(want: Optional[str], exclude: str) -> list[str]:
        if want is None:
            return []
        out = []
        for f in fns.values():
            if f.name != exclude and printer.ty(f.ret) == want:
                sig = ", ".join(f"{n}: {printer.ty(t)}" for n, t in f.params)
                out.append(f"{f.name}({sig}) -> {want}")
        return out

    for it in prog.items:
        if not isinstance(it, Fn):
            continue
        expected: dict[int, str] = {}
        for s in walk_stmts(it.body):
            if isinstance(s, Return) and isinstance(s.value, Hole):
                expected[id(s.value)] = printer.ty(it.ret)
        for e in walk_exprs(it.body):
            if isinstance(e, Call) and isinstance(e.callee, Name) and e.callee.path[0] in fns:
                target = fns[e.callee.path[0]]
                for a, (_, t) in zip(e.args, target.params):
                    if isinstance(a, Hole):
                        expected[id(a)] = printer.ty(t)
        for e in walk_exprs(it.body):
            if isinstance(e, Hole):
                want = expected.get(id(e))
                label = "?" + e.name if e.name else "?"
                diags.append(Diagnostic(
                    "H001", "error",
                    f"hole {label} in fn {it.name}: needs a value of type {want or 'unknown (v0 infers only returns and call arguments)'}",
                    e.line, e.col,
                    data={"expected": want, "candidates": candidates(want, it.name)}))
    return diags


def check(src: str, path: str = "main.cn") -> dict:
    diags: list[Diagnostic] = []
    try:
        prog = normalize(parse(src))
        canonical = program_text(prog)
    except CanonError as ce:
        return {"ok": False, "canonical": False, "diagnostics": [ce.diag.to_json()]}
    if canonical != src:
        a, b = src.splitlines(), canonical.splitlines()
        line = next((i + 1 for i, (x, y) in enumerate(zip(a, b)) if x != y),
                    min(len(a), len(b)) + 1)
        diags.append(Diagnostic(
            "C001", "error",
            "source is not in canonical form; apply the patch (Canon accepts exactly one "
            "text per program)", line, 1, fix=patch(src, canonical, path)))
    for i, l in enumerate(canonical.splitlines(), 1):
        if len(l) > MAX_LINE:
            diags.append(Diagnostic(
                "L001", "error",
                f"line is {len(l)} characters (limit {MAX_LINE}); bind a subexpression with let",
                i, MAX_LINE + 1))
    diags += check_names(prog)
    diags += check_effects(prog, src, path)
    diags += check_holes(prog)
    ok = not any(d.severity == "error" for d in diags)
    return {"ok": ok, "canonical": canonical == src,
            "diagnostics": [d.to_json() for d in diags]}


def main(argv):
    if len(argv) < 3 or argv[1] not in ("check", "fmt"):
        print(__doc__)
        return 2
    path = argv[2]
    with open(path, encoding="utf-8") as f:
        src = f.read()
    if argv[1] == "fmt":
        try:
            sys.stdout.write(fmt(src))
            return 0
        except CanonError as ce:
            print(json.dumps(ce.diag.to_json(), indent=2), file=sys.stderr)
            return 1
    result = check(src, path)
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
