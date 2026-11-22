import { CanonError, diag } from "./diagnostics.js";
import { pyRepr, pyRstrip } from "./py.js";

export type TokKind = "name" | "tname" | "int" | "float" | "str" | "kw" | "op" | "comment" | "hole" | "eof";

export interface Tok {
  kind: TokKind;
  text: string;
  line: number;
  col: number;
}

export const KEYWORDS = new Set([
  "fn", "type", "let", "var", "set", "if", "else", "match", "for", "in",
  "return", "use", "effects", "requires", "ensures", "true", "false", "test",
  "and", "or", "not", "try",
]);

const OPS = ["|>", "->", "=>", "==", "!=", "<=", ">=", "+", "-", "*", "/", "%", "<",
  ">", "=", "(", ")", "[", "]", "{", "}", ",", ":", ".", "|"];

const isDigit = (c: string) => c >= "0" && c <= "9";
const isNameStart = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isNameChar = (c: string) => isNameStart(c) || isDigit(c);

/**
 * Tokenize. Columns count code points, like the Python oracle.
 * Deviation: the oracle crashes on non-ASCII letters/digits outside strings and comments;
 * here they are reported as P001 unexpected characters (see DECISIONS.md).
 */
export function lex(source: string): Tok[] {
  const src = Array.from(source);
  const n = src.length;
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const err = (msg: string): never => {
    throw new CanonError(diag("P001", msg, line, col));
  };

  while (i < n) {
    const c = src[i];
    if (c === "\n") {
      i++;
      line++;
      col = 1;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      col++;
      continue;
    }
    if (c === "#") {
      let j = src.indexOf("\n", i);
      if (j === -1) j = n;
      toks.push({ kind: "comment", text: pyRstrip(src.slice(i, j).join("")), line, col });
      col += j - i;
      i = j;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\") j++;
        if (j < n && src[j] === "\n") err("string literal crosses a line break");
        j++;
      }
      if (j >= n) err("unterminated string literal");
      toks.push({ kind: "str", text: src.slice(i, j + 1).join(""), line, col });
      col += j + 1 - i;
      i = j + 1;
      continue;
    }
    if (c === "'") err("single-quoted strings do not exist in Canon; use double quotes");
    if (c === "?") {
      let j = i + 1;
      if (j < n && isNameStart(src[j])) {
        while (j < n && isNameChar(src[j])) j++;
      }
      const text = src.slice(i, j).join("");
      toks.push({ kind: "hole", text, line, col });
      col += j - i;
      i = j;
      continue;
    }
    if (isDigit(c)) {
      let j = i;
      while (j < n && isDigit(src[j])) j++;
      if (src[j] === "." && j + 1 < n && isDigit(src[j + 1])) {
        j++;
        while (j < n && isDigit(src[j])) j++;
      }
      if ((src[j] === "e" || src[j] === "E")) {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (k < n && isDigit(src[k])) {
          while (k < n && isDigit(src[k])) k++;
          j = k;
        }
      }
      const text = src.slice(i, j).join("");
      const kind = /[.eE]/.test(text) ? "float" : "int";
      toks.push({ kind, text, line, col });
      col += j - i;
      i = j;
      continue;
    }
    if (isNameStart(c)) {
      let j = i;
      while (j < n && isNameChar(src[j])) j++;
      const text = src.slice(i, j).join("");
      const kind = KEYWORDS.has(text) ? "kw" : text[0] >= "A" && text[0] <= "Z" ? "tname" : "name";
      toks.push({ kind, text, line, col });
      col += j - i;
      i = j;
      continue;
    }
    let matched = false;
    for (const op of OPS) {
      let ok = true;
      for (let k = 0; k < op.length; k++) {
        if (src[i + k] !== op[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        toks.push({ kind: "op", text: op, line, col });
        col += op.length;
        i += op.length;
        matched = true;
        break;
      }
    }
    if (!matched) err(`unexpected character ${pyRepr(c)}`);
  }
  toks.push({ kind: "eof", text: "", line, col });
  return toks;
}
