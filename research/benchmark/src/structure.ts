/**
 * Structural normalization (pre-registered for v0.2, see PREREGISTRATION-v0.2.md).
 * Two programs are structurally the same when they differ only in:
 *   - comments,
 *   - Canon contract clauses (`requires:` / `ensures:` lines), which are optional,
 *   - the names of things the program itself introduces (locals, helpers, lambda parameters).
 * Names the task fixes (function, parameters, declared types, fields and variants), keywords,
 * built-ins, and member names after `.` are kept. Other identifiers are renamed _1, _2, ... in
 * order of first appearance. String literal contents are left untouched.
 */
import { PRELUDE } from "@canon/compiler";
import type { Task } from "./tasks.js";

const CANON_KEYWORDS = new Set(
  "fn type let var set if else match for while in return use effects requires ensures true false test and or not try result".split(" "),
);
const CANON_BUILTINS = new Set([
  ...[...PRELUDE.matchAll(/^fn (\w+)/gm)].map((m) => m[1]),
  ..."Int Float Bool String Unit List Map Option Result Error Some None Ok Err message value error".split(" "),
]);
const TS_KEYWORDS = new Set(
  ("export function const let var if else for while do of in return true false null undefined new typeof instanceof " +
    "number string boolean void unknown any never readonly as type interface break continue switch case default throw try catch finally " +
    "Math Number String Array Object Map Set JSON parseInt parseFloat isNaN isFinite Infinity NaN BigInt Boolean RegExp Error").split(" "),
);

function givenNames(task: Task): Set<string> {
  const s = new Set<string>([task.fn, ...task.params.map(([n]) => n)]);
  for (const text of [task.decls?.canon ?? "", task.decls?.ts ?? ""]) {
    for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) s.add(m[0]);
  }
  return s;
}

export function structural(code: string, lang: "canon" | "typescript", task: Task): string {
  let text = code;
  if (lang === "canon") {
    text = text
      .split("\n")
      .filter((l) => !/^\s*#/.test(l) && !/^\s*(requires|ensures):/.test(l))
      .join("\n");
  } else {
    text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  }
  const keep = lang === "canon" ? CANON_KEYWORDS : TS_KEYWORDS;
  const given = givenNames(task);
  const names = new Map<string, string>();
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (m) {
      const id = m[0];
      const prev = out.replace(/\s+$/, "").slice(-1);
      const fixed = keep.has(id) || given.has(id) || (lang === "canon" && CANON_BUILTINS.has(id)) || prev === ".";
      if (fixed) out += id;
      else {
        if (!names.has(id)) names.set(id, `_${names.size + 1}`);
        out += names.get(id);
      }
      i += id.length;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/\n\s*\n+/g, "\n").trim();
}
