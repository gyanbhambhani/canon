/**
 * Helper for corpus.py: read [{key, lang, code}] JSON on stdin and write, for each item,
 *  - Canon: the brace text (`canon fmt`, v0.4 default) and the Canon-Py text (`fmt --syntax py`)
 *    of the same program, and the node count of its syntax tree (one tree for both surfaces);
 *  - TypeScript: the node count of its syntax tree (TypeScript compiler API, every node).
 *
 *   npx tsx --conditions=source research/v0.4/surprisal/convert.ts < in.json > out.json
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { fmt, normalize, parse, V04_PY } from "@canon/compiler";

interface In { key: string; lang: "canon" | "typescript"; code: string }

/** Nodes of a Canon AST: every object with a kind tag `k` (expressions, statements, patterns, types, items). */
function canonNodes(x: unknown): number {
  if (Array.isArray(x)) return x.reduce((s: number, y) => s + canonNodes(y), 0);
  if (!x || typeof x !== "object") return 0;
  const self = "k" in (x as object) ? 1 : 0;
  return self + Object.values(x as object).reduce((s: number, y) => s + canonNodes(y), 0);
}

function tsNodes(code: string): number {
  const sf = ts.createSourceFile("main.ts", code, ts.ScriptTarget.ES2022, true);
  let n = 0;
  const visit = (node: ts.Node) => {
    n++;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return n;
}

const items = JSON.parse(readFileSync(0, "utf8")) as In[];
const out = items.map((it) => {
  if (it.lang === "typescript") return { key: it.key, nodes: tsNodes(it.code) };
  try {
    const brace = fmt(it.code);
    const py = fmt(it.code, { features: V04_PY });
    return { key: it.key, brace, py, nodes: canonNodes(normalize(parse(brace)).items) };
  } catch (e) {
    return { key: it.key, error: (e as { diag?: { code: string; message: string } }).diag ?? String(e) };
  }
});
process.stdout.write(JSON.stringify(out));
