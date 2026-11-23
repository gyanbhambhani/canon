/** A small TextMate grammar so Shiki can highlight ```canon blocks in the docs. */
export const canonGrammar = {
  name: "canon",
  scopeName: "source.canon",
  aliases: ["cn"],
  patterns: [
    { include: "#comment" },
    { include: "#string" },
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
    hole: { match: "\\?[A-Za-z_][A-Za-z0-9_]*|\\?", name: "variable.other.hole.canon" },
    number: { match: "\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b", name: "constant.numeric.canon" },
    keyword: {
      patterns: [
        { match: "\\b(fn|type|let|var|set|if|else|match|for|while|in|return|use|test|try)\\b", name: "keyword.control.canon" },
        { match: "\\b(effects|requires|ensures)\\b", name: "storage.modifier.canon" },
        { match: "\\b(and|or|not)\\b", name: "keyword.operator.word.canon" },
        { match: "\\b(true|false)\\b", name: "constant.language.canon" },
        { match: "\\bresult\\b", name: "variable.language.canon" },
      ],
    },
    type: { match: "\\b[A-Z][A-Za-z0-9]*\\b", name: "entity.name.type.canon" },
    function: { match: "\\b[a-z_][a-z0-9_]*(?=\\()", name: "entity.name.function.canon" },
    operator: { match: "\\|>|->|=>|==|!=|<=|>=|[-+*/%<>=|]", name: "keyword.operator.canon" },
  },
};
