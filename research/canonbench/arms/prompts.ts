/**
 * Every prompt template, word for word (locked in PREREGISTRATION.md by this file's hash).
 * One template per family serves every arm; only the language name, the code fence, the signature
 * spelling and the system prompt differ. Canon's system prompt carries the core agent reference
 * (its tokens count toward Canon's cost); Python and TypeScript get no reference.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, type Case, type Lang } from "../lib/seed.js";
import { parse, PyPrinter } from "@canon/compiler";
import { canonSignature, pyDecls, pySignature, tsSignature, typeOf, type SigLike } from "../lib/types.js";

export const CANON_REFERENCE = readFileSync(join(ROOT, "apps/web/content/docs/for-agents.mdx"), "utf8")
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

/** The Canon-Py reference (served raw at /llms-py.txt), for the exploratory canon-py arm (amendment 2). */
export const CANON_PY_REFERENCE = readFileSync(join(ROOT, "apps/web/content/docs/for-agents-py.mdx"), "utf8")
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

export const LANG_NAME: Record<Lang, string> = { canon: "Canon", py: "Python", ts: "TypeScript", cpy: "Canon" };
export const FENCE: Record<Lang, string> = { canon: "canon", py: "python", ts: "ts", cpy: "canon" };

const CHECKER: Record<Lang, string> = {
  canon: "Your program is checked with `canon check` (automatic fixes applied first) and `canon test` contract fuzzing.",
  py: "Your program is checked with `mypy --strict` (after `ruff check --fix`) and Hypothesis property tests on functions that assert.",
  ts: "Your program is checked with `tsc --strict` (after `eslint --fix`) and random property tests when it asserts.",
  cpy: "Your program is checked with `canon check --syntax py` (automatic fixes applied first) and `canon test --syntax py` contract fuzzing.",
};

export function systemPrompt(lang: Lang): string {
  const fb = " Checker errors come back as JSON; an entry that has a `fix` carries a unified-diff patch, and applying that patch fixes it.";
  if (lang === "canon") return "You write programs in Canon, a small programming language. Below is its complete reference; it is all you need." + fb + "\n\n" + CANON_REFERENCE;
  if (lang === "cpy") return "You write programs in Canon, a small programming language, in its Canon-Py syntax. Below is its complete reference; it is all you need." + fb + "\n\n" + CANON_PY_REFERENCE;
  if (lang === "py") return "You write Python 3.11+ with full type annotations that pass `mypy --strict`. Use only the standard library; no I/O." + fb;
  return "You write TypeScript in strict mode (ES2022, no DOM, no Node APIs, no imports)." + fb;
}

/** The system prompt for READ: the same reference for Canon, no feedback sentence. */
export function readSystemPrompt(lang: Lang | "canon-stripped"): string {
  if (lang === "canon" || lang === "canon-stripped") return "You read programs written in Canon, a small programming language. Below is its complete reference.\n\n" + CANON_REFERENCE;
  return lang === "py" ? "You read Python programs." : "You read TypeScript programs.";
}

const OUTPUT_RULE = (lang: Lang) => `Reply with the complete program in one \`\`\`${FENCE[lang]} code block, plus at most three lines of rationale.`;

/** Brace-syntax Canon printed in Canon-Py (the same program: one syntax tree, two surfaces). */
export function toCanonPy(braceSource: string): string {
  return new PyPrinter().program(parse(braceSource)).trim();
}

function decls(lang: Lang, s: SigLike): string {
  if (lang === "canon") return s.decls?.canon ?? "";
  if (lang === "cpy") return s.decls?.canon ? toCanonPy(s.decls.canon) : "";
  if (lang === "ts") return s.decls?.ts ?? "";
  return pyDecls(s).trim();
}

function signature(lang: Lang, s: SigLike): string {
  if (lang === "cpy") {
    const pr = new PyPrinter();
    return `def ${s.fn}(${s.params.map(([n, t]) => `${n}: ${pr.ty(typeOf(t))}`).join(", ")}) -> ${pr.ty(typeOf(s.ret))}:`;
  }
  return lang === "canon" ? canonSignature(s) : lang === "py" ? pySignature(s) : tsSignature(s);
}

const fmtCase = (s: SigLike, c: Case) => `${s.fn}(${c.args.map((a) => JSON.stringify(a)).join(", ")}) == ${JSON.stringify(c.expected)}`;

export const VALUE_ENCODING =
  "Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a \"kind\" field naming it plus its fields, an optional value is the value or null, and a result is {\"ok\": true, \"value\": v} or {\"ok\": false, \"error\": e}.";

export function writePrompt(lang: Lang, s: SigLike & { desc: string; examples: Case[] }): string {
  const d = decls(lang, s);
  return (
    (d ? `Your program must start with these declarations, exactly as written:\n\n\`\`\`${FENCE[lang]}\n${d}\n\`\`\`\n\n` : "") +
    `Write a ${LANG_NAME[lang]} program that defines this function:\n\n${signature(lang, s)}\n\n${s.desc}\n\n` +
    `Examples (${VALUE_ENCODING}):\n${s.examples.map((c) => fmtCase(s, c)).join("\n")}\n\n` +
    `You may add helper functions. Do not write a main function, tests or example calls. ${CHECKER[lang]}\n\n${OUTPUT_RULE(lang)}`
  );
}

export function fixPrompt(lang: Lang, s: SigLike & { desc: string }, broken: string, fail: { args: unknown[]; expected: unknown; actual: unknown; error?: string }, checkerOutput: string): string {
  return (
    `This ${LANG_NAME[lang]} program defines \`${s.fn}\` but has a bug.\n\nSpecification:\n${s.desc}\n\n` +
    `\`\`\`${FENCE[lang]}\n${broken.trimEnd()}\n\`\`\`\n\n` +
    `A failing example (${VALUE_ENCODING}):\n  input: ${s.fn}(${fail.args.map((a) => JSON.stringify(a)).join(", ")})\n  expected: ${JSON.stringify(fail.expected)}\n  actual: ${fail.error ? `error: ${fail.error}` : JSON.stringify(fail.actual)}\n\n` +
    `Checker output:\n${checkerOutput || "(no errors)"}\n\n` +
    `Fix the bug. Keep the declarations and the function's signature unchanged. ${CHECKER[lang]}\n\n${OUTPUT_RULE(lang)}`
  );
}

export function changePrompt(lang: Lang, s: SigLike, program: string, requirement: string): string {
  const d = decls(lang, s);
  return (
    `This ${LANG_NAME[lang]} program defines \`${s.fn}\` and works as specified.\n\n\`\`\`${FENCE[lang]}\n${program.trimEnd()}\n\`\`\`\n\n` +
    `Change request:\n${requirement}\n\n` +
    (d ? `After the change, the program must start with these declarations, exactly as written:\n\n\`\`\`${FENCE[lang]}\n${d}\n\`\`\`\n\n` : "") +
    `After the change, the function's signature is:\n\n${signature(lang, s)}\n\n` +
    `Update the program. Everything the change request does not mention must keep working exactly as before. ${CHECKER[lang]}\n\n${OUTPUT_RULE(lang)}`
  );
}

export function feedbackPrompt(lang: Lang, feedback: string): string {
  return `${feedback}\n\nFix the program. ${OUTPUT_RULE(lang)}`;
}

export function readPrompt(lang: Lang | "canon-stripped", program: string, question: string, answerFormat: string): string {
  const fence = lang === "canon-stripped" ? "canon" : FENCE[lang];
  return (
    `\`\`\`${fence}\n${program.trimEnd()}\n\`\`\`\n\n${question}\n\n` +
    `Think as briefly as you need to, then give your final answer on the last line, in exactly this form:\nANSWER: ${answerFormat}`
  );
}

export function extractCode(text: string, lang: Lang): string {
  const alts = lang === "canon" ? "canon|cn" : lang === "cpy" ? "canon|cn|python|py" : lang === "py" ? "python|py" : "ts|typescript";
  const re = new RegExp("```(?:" + alts + ")?[^\\n]*\\n([\\s\\S]*?)```", "g");
  let m: RegExpExecArray | null;
  let best = "";
  while ((m = re.exec(text))) if (m[1].length > best.length) best = m[1];
  return (best || text).replace(/\s+$/, "") + "\n";
}
