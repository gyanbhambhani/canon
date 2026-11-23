/**
 * Authoring aid: `canon check --fix --write` for effects/<id>/program.cn files, then prints what is
 * left. Usage: npx tsx --conditions=source sandbox/effects/canon_fix.ts effects/<id>/program.cn...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fix } from "@canon/compiler";

for (const path of process.argv.slice(2)) {
  const src = readFileSync(path, "utf8");
  const r = fix(src, "program.cn");
  if (r.source !== src) writeFileSync(path, r.source);
  console.log(`${path}: applied ${r.applied.map((a: { code?: string } | string) => (typeof a === "string" ? a : a.code)).join(",") || "nothing"}`);
  for (const d of r.result.diagnostics) console.log(`  ${d.code} ${d.line}:${d.col} ${d.message}`);
}
