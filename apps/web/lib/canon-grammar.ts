/**
 * A small TextMate grammar so Shiki can highlight ```canon blocks in the docs, in brace syntax and
 * in Canon-Py (v0.4): the two surfaces' keywords never clash, so one grammar serves both.
 */
export const canonGrammar = {
  name: "canon",
  scopeName: "source.canon",
  aliases: ["cn"],
  patterns: [
    { include: "#comment" },
    { include: "#string" },
    { include: "#string_single" },
    { include: "#hole" },
    { include: "#number" },
    { include: "#keyword" },
    { include: "#type" },
    { include: "#function" },
    { include: "#operator" },
  ],
  repository: {
    comment: { match: "#.*$", name: "comment.line.number-sign.canon" },
    string: {
      begin: '"',
      end: '"',
      name: "string.quoted.double.canon",
      patterns: [{ match: "\\\\.", name: "constant.character.escape.canon" }],
    },
    // Canon-Py accepts single quotes (fmt rewrites them to double quotes)
    string_single: {
      begin: "'",
      end: "'",
      name: "string.quoted.single.canon",
      patterns: [{ match: "\\\\.", name: "constant.character.escape.canon" }],
    },
    // brace holes ? and ?name; Canon-Py holes ...; a ? after a call or name is Canon-Py's Result suffix
    hole: { match: "\\?[A-Za-z_][A-Za-z0-9_]*|(?<![\\w)\\]])\\?|\\.\\.\\.", name: "variable.other.hole.canon" },
    number: { match: "\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b", name: "constant.numeric.canon" },
    keyword: {
      patterns: [
        { match: "\\b(fn|type|let|var|set|if|else|match|for|while|break|in|return|use|test|try|def|class|elif|case|lambda|pass|import|assert)\\b", name: "keyword.control.canon" },
        { match: "\\b(effects|requires|ensures)\\b", name: "storage.modifier.canon" },
        { match: "\\b(and|or|not|is)\\b", name: "keyword.operator.word.canon" },
        { match: "\\b(true|false|True|False)\\b", name: "constant.language.canon" },
        { match: "\\bresult\\b", name: "variable.language.canon" },
      ],
    },
    type: { match: "\\b[A-Z][A-Za-z0-9]*\\b", name: "entity.name.type.canon" },
    function: { match: "\\b[a-z_][a-z0-9_]*(?=\\()", name: "entity.name.function.canon" },
    operator: { match: "\\|>|->|=>|==|!=|<=|>=|&&|\\|\\||[-+*/%<>=|!?]", name: "keyword.operator.canon" },
  },
};
