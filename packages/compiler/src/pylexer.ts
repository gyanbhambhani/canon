/**
 * v0.4 lexer: the Python-shaped surface (docs/v0.4-design.md). Emits NEWLINE, INDENT and DEDENT
 * like Python's tokenizer. Newlines inside brackets are ignored. A comment line takes the
 * indentation of the code around it: it stays in a deeper block only if it is indented as deeply
 * as that block, and otherwise belongs with the next code line.
 */
import { CanonError, diag } from "./diagnostics.js";
import { pyRepr, pyRstrip } from "./py.js";

export type PyTokKind =
  | "name" | "tname" | "int" | "float" | "str" | "fstr" | "kw" | "op" | "comment" | "hole"
  | "newline" | "indent" | "dedent" | "eof";

export interface PyTok {
  kind: PyTokKind;
  text: string;
  line: number;
  col: number;
}

export const PY_KEYWORDS = new Set([
  "def", "class", "type", "if", "elif", "else", "for", "in", "while", "return", "match", "case",
  "lambda", "and", "or", "not", "is", "pass", "import", "break", "assert",
  // rejected with a message naming the Canon form
  "continue", "try", "except", "finally", "raise", "with", "yield", "global", "nonlocal", "del",
  "async", "await", "from",
]);

// longest first
const OPS = ["...", "//=", "**=", "->", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "//", "**", "|>", "&&",
  "||", "=>", "+", "-", "*", "/", "%", "<", ">", "=", "(", ")", "[", "]", "{", "}", ",", ":", ".", "|", "!",
  "?", "@", ";"];

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isNameStart = (c: string | undefined) => c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
const isNameChar = (c: string | undefined) => isNameStart(c) || isDigit(c);

/** A single-quoted string's body re-spelled with double quotes (the canonical form). */
function toDoubleQuoted(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && i + 1 < body.length) {
      const d = body[i + 1];
      out += d === "'" ? "'" : c + d;
      i++;
    } else if (c === '"') {
      out += '\\"';
    } else {
      out += c;
    }
  }
  return `"${out}"`;
}

export interface LexOptions {
  /** Lex an expression fragment (inside an f-string): no indentation, no NEWLINE tokens. */
  fragment?: boolean;
  line?: number;
  col?: number;
}

export function pyLex(source: string, opts: LexOptions = {}): PyTok[] {
  const src = Array.from(source);
  const n = src.length;
  const toks: PyTok[] = [];
  let i = 0;
  let line = opts.line ?? 1;
  let col = opts.col ?? 1;
  let depth = opts.fragment ? 1 : 0;
  const indents = [0];
  let atLineStart = !opts.fragment;
  const err = (msg: string, l = line, c = col): never => {
    throw new CanonError(diag("P001", msg, l, c));
  };
  const push = (kind: PyTokKind, text: string, l = line, c = col) => toks.push({ kind, text, line: l, col: c });
  const lastKind = () => (toks.length ? toks[toks.length - 1].kind : "newline");

  /** Indentation of the next line that holds code (not blank, not only a comment); -1 at EOF. */
  const nextCodeIndent = (from: number): number => {
    let j = from;
    while (j < n) {
      let k = j;
      let w = 0;
      while (k < n && src[k] === " ") {
        k++;
        w++;
      }
      if (k >= n) return -1;
      if (src[k] === "\n" || src[k] === "\r" || src[k] === "#") {
        while (k < n && src[k] !== "\n") k++;
        j = k + 1;
        continue;
      }
      return w;
    }
    return -1;
  };

  const dedentTo = (w: number, l: number, c: number, strict: boolean) => {
    while (indents[indents.length - 1] > w) {
      indents.pop();
      push("dedent", "", l, c);
    }
    if (strict && indents[indents.length - 1] !== w) {
      err("indentation does not match any outer block (indent with 4 spaces per level)", l, c);
    }
  };

  while (i < n) {
    if (atLineStart) {
      // measure indentation
      let w = 0;
      let j = i;
      while (j < n && (src[j] === " " || src[j] === "\t")) {
        if (src[j] === "\t") err("tabs are not allowed; indent with 4 spaces per level", line, j - i + 1);
        w++;
        j++;
      }
      if (j >= n) {
        i = j;
        break;
      }
      if (src[j] === "\n" || src[j] === "\r") {
        // blank line
        while (j < n && src[j] !== "\n") j++;
        i = j + 1;
        line++;
        col = 1;
        continue;
      }
      if (src[j] === "#") {
        // a comment line: belongs to the deepest open block it is indented into, but never deeper
        // than the next code line's block unless indented to match an open block
        const next = nextCodeIndent(j);
        const eff = next < 0 ? Math.min(w, indents[indents.length - 1]) : Math.max(Math.min(w, indents[indents.length - 1]), next);
        if (eff > indents[indents.length - 1]) {
          // the first line of a block is a comment: the block opens here
          indents.push(eff);
          push("indent", "", line, w + 1);
        } else {
          dedentTo(eff, line, w + 1, false);
        }
        let k = j;
        while (k < n && src[k] !== "\n") k++;
        push("comment", pyRstrip(src.slice(j, k).join("")), line, w + 1);
        push("newline", "", line, k - i + 1);
        i = k + 1;
        line++;
        col = 1;
        continue;
      }
      col = w + 1;
      i = j;
      const top = indents[indents.length - 1];
      if (w > top) {
        indents.push(w);
        push("indent", "", line, col);
      } else if (w < top) {
        dedentTo(w, line, col, true);
      }
      atLineStart = false;
    }

    const c = src[i];
    if (c === "\n") {
      if (depth === 0 && !opts.fragment) {
        push("newline", "", line, col);
        atLineStart = true;
      }
      i++;
      line++;
      col = 1;
      continue;
    }
    if (c === " " || c === "\r" || c === "\t") {
      i++;
      col++;
      continue;
    }
    if (c === "\\" && src[i + 1] === "\n") err("line continuations with \\ are not allowed; break inside brackets");
    if (c === "#") {
      let j = src.indexOf("\n", i);
      if (j === -1) j = n;
      push("comment", pyRstrip(src.slice(i, j).join("")));
      col += j - i;
      i = j;
      continue;
    }
    // strings: "..." '...' f"..." f'...'
    let prefix = "";
    if ((c === "f" || c === "F") && (src[i + 1] === '"' || src[i + 1] === "'")) prefix = "f";
    else if ((c === "r" || c === "b" || c === "R" || c === "B" || c === "u" || c === "U") && (src[i + 1] === '"' || src[i + 1] === "'")) {
      err(`${c}-prefixed strings do not exist in Canon; use a plain "..." string`);
    }
    const q = src[i + prefix.length];
    if (q === '"' || q === "'") {
      const start = i;
      const startCol = col;
      let j = i + prefix.length;
      if (src[j + 1] === q && src[j + 2] === q) {
        err("triple-quoted strings (docstrings) do not exist in Canon; write # comments on their own lines");
      }
      j++;
      let braceDepth = 0;
      while (j < n && (src[j] !== q || braceDepth > 0)) {
        if (src[j] === "\\") j++;
        else if (prefix && src[j] === "{") {
          if (src[j + 1] === "{" && braceDepth === 0) j++;
          else braceDepth++;
        } else if (prefix && src[j] === "}") {
          if (braceDepth === 0 && src[j + 1] === "}") j++;
          else if (braceDepth > 0) braceDepth--;
        } else if (prefix && braceDepth > 0 && (src[j] === '"' || src[j] === "'")) {
          // a string inside an f-string's expression
          const iq = src[j];
          j++;
          while (j < n && src[j] !== iq && src[j] !== "\n") {
            if (src[j] === "\\") j++;
            j++;
          }
        }
        if (j < n && src[j] === "\n") err("string literal crosses a line break");
        j++;
      }
      if (j >= n) err("unterminated string literal");
      const body = src.slice(start + prefix.length + 1, j).join("");
      // an f-string token's text is its quote character followed by its body
      if (prefix) push("fstr", q + body, line, startCol);
      else push("str", q === '"' ? `"${body}"` : toDoubleQuoted(body), line, startCol);
      col += j + 1 - start;
      i = j + 1;
      continue;
    }
    if (c === "?" && isNameStart(src[i + 1]) && !["name", "tname", "int", "float", "str", "fstr"].includes(lastKind()) &&
      !(toks.length && toks[toks.length - 1].kind === "op" && [")", "]"].includes(toks[toks.length - 1].text))) {
      // a v0.3 named hole (?name); v0.4 prints holes as ...
      let j = i + 1;
      while (j < n && isNameChar(src[j])) j++;
      push("hole", src.slice(i, j).join(""));
      col += j - i;
      i = j;
      continue;
    }
    if (isDigit(c)) {
      let j = i;
      while (j < n && isDigit(src[j])) j++;
      if (src[j] === "_") err("underscores in numbers are not allowed in Canon");
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (j < n && isDigit(src[j])) j++;
      }
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (isDigit(src[k])) {
          while (k < n && isDigit(src[k])) k++;
          j = k;
        }
      }
      const text = src.slice(i, j).join("");
      push(/[.eE]/.test(text) ? "float" : "int", text);
      col += j - i;
      i = j;
      continue;
    }
    if (isNameStart(c)) {
      let j = i;
      while (j < n && isNameChar(src[j])) j++;
      const text = src.slice(i, j).join("");
      const kind: PyTokKind = PY_KEYWORDS.has(text) ? "kw" : text[0] >= "A" && text[0] <= "Z" ? "tname" : "name";
      push(kind, text);
      col += j - i;
      i = j;
      continue;
    }
    let matched = "";
    for (const op of OPS) {
      let ok = true;
      for (let k = 0; k < op.length; k++) {
        if (src[i + k] !== op[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matched = op;
        break;
      }
    }
    if (!matched) err(`unexpected character ${pyRepr(c)}`);
    if (matched === "(" || matched === "[" || matched === "{") depth++;
    else if ((matched === ")" || matched === "]" || matched === "}") && depth > (opts.fragment ? 1 : 0)) depth--;
    push("op", matched);
    col += matched.length;
    i += matched.length;
  }
  if (!opts.fragment) {
    if (lastKind() !== "newline" && toks.length) push("newline", "", line, col);
    dedentTo(0, line, col, false);
  }
  push("eof", "", line, col);
  return toks;
}
