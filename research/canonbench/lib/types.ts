/**
 * Type mapping shared by every adapter. A seed's signature is written in Canon type syntax; each
 * language gets the same signature in its own types (the mapping is Experiment 1's):
 *   Int -> int / number, Float -> float / number, String -> str / string, Bool -> bool / boolean,
 *   List[T] -> list[T] / T[], Option[T] -> T | None / T | null, (A, B) -> tuple / [A, B],
 *   records and variants -> TypedDicts / interfaces (variants carry a `kind` tag),
 *   Result[T, String] -> Ok[T] | Err / Result<T>, both { ok, value } | { ok, error } in JSON.
 */
import { lex, parse, Parser, type TypeExpr } from "@canon/compiler";

export const typeOf = (s: string): TypeExpr => new Parser(lex(s)).typeExpr();

export function pyType(t: TypeExpr): string {
  if (t.k === "TTuple") return `tuple[${t.items.map(pyType).join(", ")}]`;
  if (t.k === "TFn") return `Callable[[${t.params.map(pyType).join(", ")}], ${pyType(t.ret)}]`;
  switch (t.name) {
    case "Int":
      return "int";
    case "Float":
      return "float";
    case "String":
      return "str";
    case "Bool":
      return "bool";
    case "Unit":
      return "None";
    case "List":
      return `list[${pyType(t.args[0])}]`;
    case "Option":
      return `${pyType(t.args[0])} | None`;
    case "Result":
      return `Ok[${pyType(t.args[0])}] | Err`;
  }
  return t.name;
}

export function tsType(t: TypeExpr): string {
  if (t.k === "TTuple") return `[${t.items.map(tsType).join(", ")}]`;
  if (t.k === "TFn") return `(${t.params.map((p, i) => `a${i}: ${tsType(p)}`).join(", ")}) => ${tsType(t.ret)}`;
  switch (t.name) {
    case "Int":
    case "Float":
      return "number";
    case "String":
      return "string";
    case "Bool":
      return "boolean";
    case "List": {
      const inner = tsType(t.args[0]);
      return /[|\s]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
    }
    case "Option":
      return `${tsType(t.args[0])} | null`;
    case "Result":
      return `Result<${tsType(t.args[0])}>`;
  }
  return t.name;
}

export interface SigLike {
  fn: string;
  params: [string, string][];
  ret: string;
  decls?: { canon: string; ts: string };
}

/** Python declarations: the Result helpers when used, and TypedDicts for the seed's types. */
export function pyDecls(s: SigLike): string {
  const lines: string[] = ["from __future__ import annotations", "from typing import Callable, Generic, Literal, TypedDict, TypeVar", ""];
  const usesResult = [s.ret, ...s.params.map(([, t]) => t)].some((t) => t.includes("Result"));
  if (usesResult) {
    lines.push('T = TypeVar("T")', "", "class Ok(TypedDict, Generic[T]):", "    ok: Literal[True]", "    value: T", "", "class Err(TypedDict):", "    ok: Literal[False]", "    error: str", "");
  }
  if (s.decls?.canon) {
    for (const it of parse(s.decls.canon).items) {
      if (it.k === "RecordType") {
        lines.push(`class ${it.name}(TypedDict):`, ...it.fields.map(([n, t]) => `    ${n}: ${pyType(t)}`), "");
      } else if (it.k === "SumType") {
        const names: string[] = [];
        for (const [vn, fields] of it.variants) {
          names.push(vn);
          lines.push(`class ${vn}(TypedDict):`, `    kind: Literal["${vn}"]`, ...fields.map(([n, t]) => `    ${n}: ${pyType(t)}`), "");
        }
        lines.push(`${it.name} = ${names.join(" | ")}`, "");
      }
    }
  }
  return lines.join("\n").trim() + "\n";
}

export const pySignature = (s: SigLike) => `def ${s.fn}(${s.params.map(([n, t]) => `${n}: ${pyType(typeOf(t))}`).join(", ")}) -> ${pyType(typeOf(s.ret))}:`;
export const tsSignature = (s: SigLike) => `export function ${s.fn}(${s.params.map(([n, ty]) => `${n}: ${tsType(typeOf(ty))}`).join(", ")}): ${tsType(typeOf(s.ret))}`;
export const canonSignature = (s: SigLike) => `fn ${s.fn}(${s.params.map(([n, ty]) => `${n}: ${ty}`).join(", ")}) -> ${s.ret}`;
