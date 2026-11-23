/** CodeMirror 6 stream mode for Canon highlighting in the playground. */
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const KEYWORDS = new Set(["fn", "type", "let", "var", "set", "if", "else", "match", "for", "in", "while", "break", "return", "use", "test", "try", "and", "or", "not"]);
const MODIFIERS = new Set(["effects", "requires", "ensures", "result"]);

const parser: StreamParser<null> = {
  name: "canon",
  tokenTable: { fnName: tags.function(tags.variableName) },
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^#.*/)) return "comment";
    if (stream.match(/^"(?:\\.|[^"\\])*"?/)) return "string";
    if (stream.match(/^\?[A-Za-z_][A-Za-z0-9_]*/) || stream.match("?")) return "invalid";
    if (stream.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return "number";
    const w = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/) as RegExpMatchArray | null;
    if (w) {
      const word = w[0];
      if (KEYWORDS.has(word)) return "keyword";
      if (MODIFIERS.has(word)) return "modifier";
      if (word === "true" || word === "false") return "bool";
      if (/^[A-Z]/.test(word)) return "typeName";
      if (stream.peek() === "(") return "fnName";
      return "variableName";
    }
    if (stream.match(/^(\|>|->|=>|==|!=|<=|>=|&&|\|\||[-+*/%<>=|!])/)) return "operator";
    stream.next();
    return null;
  },
};

export const canonLanguage = StreamLanguage.define(parser);
