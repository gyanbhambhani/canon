/**
 * v0.5: line breaking for generated Python, matching ruff format (Black's style, 88 columns).
 * The generator writes each logical line flat; this splits the ones that are too long, the way
 * Black does: a right-hand split at the last bracket pair, then a delimiter split of its body
 * (one item per line with a trailing comma, or one operand per line before each operator), with
 * optional parentheses around the right side of return, assignment and conditions.
 */

export const PY_LINE = 88;

interface Tok {
  t: string;
  /** a space before this token in the flat rendering */
  sp: boolean;
  /** an opening bracket the generator added (optional parentheses), dropped if unused */
  invisible?: boolean;
}

const OPEN = new Set(["(", "[", "{"]);
const CLOSE = new Set([")", "]", "}"]);
const KEYWORD_OPS = new Set(["and", "or", "not", "in", "is", "if", "else", "for", "lambda", "async", "await"]);

/** Tokenize one flat line of generated Python, remembering where spaces were. */
export function pyTokens(line: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let sp = false;
  while (i < line.length) {
    const c = line[i];
    if (c === " ") {
      sp = true;
      i++;
      continue;
    }
    let j = i + 1;
    if ((c === '"' || c === "'") || ((c === "f" || c === "b" || c === "r") && (line[i + 1] === '"' || line[i + 1] === "'"))) {
      let q = c;
      j = i;
      if (c !== '"' && c !== "'") {
        q = line[i + 1];
        j = i + 1;
      }
      j++;
      while (j < line.length && line[j] !== q) {
        if (line[j] === "\\") j++;
        j++;
      }
      j++;
    } else if (/[A-Za-z_]/.test(c)) {
      j = i + /^[A-Za-z_][A-Za-z_0-9]*/.exec(line.slice(i))![0].length;
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1] ?? ""))) {
      j = i + /^[0-9_]*(\.[0-9_]*)?([eE][+-]?[0-9]+)?/.exec(line.slice(i))![0].length;
    } else {
      const two = line.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "->", "**", "//", ":=", "+=", "-=", "*=", "/="].includes(two)) j = i + 2;
    }
    toks.push({ t: line.slice(i, j), sp });
    sp = false;
    i = j;
  }
  return toks;
}

const render = (toks: Tok[]): string => toks.map((x, i) => (i > 0 && x.sp ? " " : "") + x.t).join("");

function matching(toks: Tok[], close: number): number {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (CLOSE.has(toks[i].t)) depth++;
    else if (OPEN.has(toks[i].t)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Black's delimiter priorities. */
function priority(toks: Tok[], i: number): number {
  const t = toks[i].t;
  if (t === ",") return 18;
  if ((t === "for" || t === "async") && i > 0) return 20;
  if (t === "if" && i > 0 && toks.slice(0, i).some((x) => x.t === "for")) return 20;
  if ((t === "if" || t === "else") && i > 0) return 16;
  if (t === "or" || t === "and") return 14;
  if (t === "not" && toks[i - 1]?.t !== "is" && i > 0 && toks[i - 1]?.t !== "(" && !isOperandStart(toks, i)) return 10;
  if (["<", ">", "==", "!=", "<=", ">=", "in", "is"].includes(t) && i > 0) return t === "in" && toks[i - 1]?.t === "not" ? 0 : 10;
  if (t === "|") return 9;
  if ((t === "+" || t === "-") && i > 0 && !isUnary(toks, i)) return 5;
  if (["*", "/", "%", "//", "@"].includes(t) && i > 0) return 4;
  return 0;
}

function isUnary(toks: Tok[], i: number): boolean {
  const prev = toks[i - 1];
  return !prev || OPEN.has(prev.t) || prev.t === "," || priority(toks, i - 1) > 0 || ["return", "=", ":", "lambda", "not", "else", "if"].includes(prev.t);
}

function isOperandStart(toks: Tok[], i: number): boolean {
  const prev = toks[i - 1];
  return !prev || OPEN.has(prev.t) || prev.t === "," || ["and", "or", "return", "=", "if", "else", "not", "("].includes(prev.t);
}

/** Delimiters at depth 0 of a token run, with their priority. */
function delimiters(toks: Tok[]): { i: number; p: number }[] {
  const out: { i: number; p: number }[] = [];
  let depth = 0;
  let inLambda = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].t;
    if (OPEN.has(t)) depth++;
    else if (CLOSE.has(t)) depth--;
    else if (depth === 0) {
      if (t === "lambda") inLambda = true;
      if (inLambda && t === ":") {
        inLambda = false;
        continue;
      }
      if (inLambda) continue;
      const p = priority(toks, i);
      if (p > 0) out.push({ i, p });
    }
  }
  return out;
}

const fits = (indent: string, toks: Tok[]) => indent.length + render(toks).length <= PY_LINE;

/** Split one logical line (already indented by `indent`) into lines that fit, Black's way. */
export function splitLine(indent: string, line: string, optionalParens = true): string[] {
  let toks = pyTokens(line);
  if (optionalParens) toks = addOptionalParens(toks);
  return split(indent, toks);
}

/**
 * The right side of `return`, `x =`, `if`, `elif`, `while`, `assert` and `for ... in` may be
 * wrapped in parentheses when that is the only way to split it (Black's invisible parentheses).
 */
function addOptionalParens(toks: Tok[]): Tok[] {
  let start = -1;
  let end = toks.length;
  const first = toks[0]?.t;
  if (first === "return" || first === "del") start = 1;
  else if (first === "assert") {
    start = 1;
    let depth = 0;
    for (let i = 1; i < toks.length; i++) {
      if (OPEN.has(toks[i].t)) depth++;
      else if (CLOSE.has(toks[i].t)) depth--;
      else if (depth === 0 && toks[i].t === ",") {
        end = i;
        break;
      }
    }
  }
  else if (first === "if" || first === "elif" || first === "while") {
    start = 1;
    end = toks.length - 1; // the colon
  } else if (first === "for") {
    const at = toks.findIndex((x, i) => x.t === "in" && i > 0);
    if (at > 0) {
      start = at + 1;
      end = toks.length - 1;
    }
  } else {
    let depth = 0;
    for (let i = 0; i < toks.length; i++) {
      if (OPEN.has(toks[i].t)) depth++;
      else if (CLOSE.has(toks[i].t)) depth--;
      else if (depth === 0 && ["=", "+=", "-=", "*=", "/="].includes(toks[i].t)) {
        start = i + 1;
        break;
      }
    }
  }
  if (start < 0 || start >= end) return toks;
  // already one bracketed atom: no parentheses needed
  if (OPEN.has(toks[start].t) && matching(toks, end - 1) === start) return toks;
  return [
    ...toks.slice(0, start),
    { t: "(", sp: toks[start].sp, invisible: true },
    { ...toks[start], sp: false },
    ...toks.slice(start + 1, end),
    { t: ")", sp: false, invisible: true },
    ...toks.slice(end),
  ];
}

/** Drop the optional parentheses that were not used. */
function visible(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const x = toks[i];
    if (x.invisible) {
      if (x.t === "(" && toks[i + 1]) toks[i + 1] = { ...toks[i + 1], sp: x.sp };
      continue;
    }
    out.push(x);
  }
  return out;
}

function split(indent: string, toks: Tok[]): string[] {
  const flat = visible(toks);
  if (fits(indent, flat)) return [indent + render(flat)];
  // bracket pairs at depth 0, rightmost first (Black's right-hand split, omitting trailers)
  const pairs: [number, number][] = [];
  let depth = 0;
  for (let i = toks.length - 1; i >= 0; i--) {
    if (CLOSE.has(toks[i].t)) {
      if (depth === 0) pairs.push([matching(toks, i), i]);
      depth++;
    } else if (OPEN.has(toks[i].t)) depth--;
  }
  let candidates = pairs.filter(([o, c]) => c > o + 1);
  if (!candidates.length) return [indent + render(flat)];
  // optional parentheses: Black omits them when the last real bracket can carry the split
  const [o0, c0] = candidates[0];
  if (toks[o0].invisible) {
    const body = toks.slice(o0 + 1, c0);
    const ds = delimiters(body);
    const max = Math.max(0, ...ds.map((d) => d.p));
    const count = ds.filter((d) => d.p === max).length;
    const innerClose = c0 - 1;
    const innerOpen = CLOSE.has(toks[innerClose].t) ? matching(toks, innerClose) : -1;
    const canOmit = ds.length === 0 || (count <= 1 && innerOpen > o0 && innerOpen < innerClose - 1 &&
      indent.length + render(visible(toks.slice(0, innerOpen + 1))).length <= PY_LINE);
    if (canOmit) return split(indent, flat);
    candidates = [candidates[0]];
  }
  // a def splits its parameters before its return annotation (ruff's rule)
  const params = toks[0]?.t === "def" ? candidates.find(([o]) => o === 2) : undefined;
  const chosen = params ?? candidates.find(([o]) => fits(indent, visible(toks.slice(0, o + 1)))) ?? candidates[0];
  const [open, close] = chosen;
  const reveal = (x: Tok): Tok => ({ t: x.t, sp: x.sp });
  const head = [...toks.slice(0, open), reveal(toks[open])];
  const body = toks.slice(open + 1, close).map((x, i) => (i === 0 ? { ...x, sp: false } : x));
  const tail = [{ ...reveal(toks[close]), sp: false }, ...toks.slice(close + 1)];
  const inner = indent + "    ";
  const out: string[] = [...split(indent, head)];
  const flatBody = visible(body);
  if (fits(inner, flatBody) && !(flatBody.length && flatBody[flatBody.length - 1].t === ",")) {
    out.push(inner + render(flatBody));
  } else {
    out.push(...delimiterSplit(inner, body, toks[open].t === "[" && isSubscript(toks, open)));
  }
  out.push(...split(indent, tail));
  return out;
}

/** A line inside brackets: Black tries a delimiter split before a right-hand split. */
function splitInside(indent: string, toks: Tok[]): string[] {
  const flat = visible(toks);
  if (fits(indent, flat)) return [indent + render(flat)];
  const body = flat[flat.length - 1]?.t === "," ? flat.slice(0, -1) : flat;
  if (delimiters(body).length) return delimiterSplit(indent, toks, false, true);
  return split(indent, toks);
}

function isSubscript(toks: Tok[], open: number): boolean {
  const prev = toks[open - 1];
  return !!prev && (/^[A-Za-z_0-9]/.test(prev.t) || CLOSE.has(prev.t)) && !KEYWORD_OPS.has(prev.t) && prev.t !== "return";
}

function delimiterSplit(indent: string, body: Tok[], subscript: boolean, inside = false): string[] {
  // a trailing comma is not a delimiter to split at
  const ds = delimiters(body).filter((d) => !(d.p === 18 && d.i === body.length - 1));
  if (!ds.length) return split(indent, body);
  const max = Math.max(...ds.map((d) => d.p));
  const at = ds.filter((d) => d.p === max).map((d) => d.i);
  const parts: Tok[][] = [];
  let from = 0;
  for (const i of at) {
    if (max === 18) {
      parts.push(body.slice(from, i + 1));
      from = i + 1;
    } else {
      parts.push(body.slice(from, i));
      from = i;
    }
  }
  parts.push(body.slice(from));
  const lines: string[] = [];
  const nonEmpty = parts.filter((p) => p.length);
  nonEmpty.forEach((p, n) => {
    let piece = p.map((x, i) => (i === 0 ? { ...x, sp: false } : x));
    const lastPart = n === nonEmpty.length - 1;
    if (max === 18 && lastPart && !(subscript && nonEmpty.length === 1) && piece[piece.length - 1].t !== ",") {
      piece = [...piece, { t: ",", sp: false }];
    }
    lines.push(...(inside && piece === p ? split(indent, piece) : splitInside(indent, piece)));
  });
  return lines;
}

/** Format a block of indented logical lines: every line too long is split. */
export function formatPy(lines: string[]): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l.trim() === "" || l.trimStart().startsWith("#") || l.length <= PY_LINE) {
      out.push(l);
      continue;
    }
    const indent = /^ */.exec(l)![0];
    const text = l.slice(indent.length);
    const imp = /^from (\S+) import (.+)$/.exec(text);
    if (imp && !text.includes("(")) {
      out.push(`${indent}from ${imp[1]} import (`, ...imp[2].split(", ").map((n) => `${indent}    ${n},`), `${indent})`);
      continue;
    }
    const isDef = /^(async )?def /.test(text) || text.startsWith("class ") || text.startsWith("@");
    out.push(...splitLine(indent, text, !isDef));
  }
  return out.join("\n");
}
