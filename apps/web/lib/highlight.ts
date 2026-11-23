/** A small Canon tokenizer for display (landing page). Mirrors the grammar's token classes. */
export type TokenClass = "kw" | "mod" | "lit" | "str" | "num" | "com" | "type" | "fn" | "hole" | "op" | "plain";

// brace syntax and Canon-Py (v0.4) share one highlighter: their keywords never clash
const KEYWORDS = new Set([
  "fn", "type", "let", "var", "set", "if", "else", "match", "for", "in", "while", "break", "return", "use", "test", "try", "and", "or", "not",
  "def", "class", "elif", "case", "lambda", "is", "pass", "import", "assert",
]);
const MODIFIERS = new Set(["effects", "requires", "ensures", "result"]);
const RE = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\?[A-Za-z_][A-Za-z0-9_]*|(?<![\w)\]])\?|\.\.\.)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\|>|->|=>|==|!=|<=|>=|&&|\|\||[-+*/%<>=|!?])|(\s+|.)/gy;

export function tokenize(src: string): [TokenClass, string][] {
  const out: [TokenClass, string][] = [];
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(src))) {
    const [text, com, str, hole, num, word, op] = m;
    let cls: TokenClass = "plain";
    if (com) cls = "com";
    else if (str) cls = "str";
    else if (hole) cls = "hole";
    else if (num) cls = "num";
    else if (word) {
      if (KEYWORDS.has(word)) cls = "kw";
      else if (MODIFIERS.has(word)) cls = "mod";
      else if (word === "true" || word === "false" || word === "True" || word === "False") cls = "lit";
      else if (/^[A-Z]/.test(word)) cls = "type";
      else if (src[RE.lastIndex] === "(") cls = "fn";
    } else if (op) cls = "op";
    const last = out[out.length - 1];
    if (last && last[0] === cls && cls === "plain") last[1] += text;
    else out.push([cls, text]);
  }
  return out;
}
