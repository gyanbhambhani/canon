/**
 * Convert brace-syntax programs to Canon-Py with fmt and report what does not survive the trip.
 *
 *   tsx --conditions=source scripts/py-corpus.ts [--write DIR] FILE...
 *
 * For each file: Canon-Py text = fmt(src, py). Checks that it is a fmt fixed point in Canon-Py,
 * that converting it back to braces and to Canon-Py again gives the same text, and that it checks
 * clean when the brace source does. With --write DIR, writes DIR/<name> (same file name).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { check, fmt, readSource, V04_PY } from "@canon/compiler";

const py = { features: V04_PY };
const args = process.argv.slice(2);
let out: string | null = null;
if (args[0] === "--write") {
  out = args[1];
  args.splice(0, 2);
  mkdirSync(out, { recursive: true });
}
let bad = 0;
for (const f of args) {
  const src = readSource(readFileSync(f, "utf8"));
  const problems: string[] = [];
  let text = "";
  try {
    text = fmt(src, py);
    if (fmt(text, py) !== text) problems.push("not a Canon-Py fixed point");
    if (fmt(fmt(text), py) !== text) problems.push("brace round trip changes it");
    if (check(src, f).ok && !check(text, f, py).ok) {
      problems.push("checks in braces but not in Canon-Py: " + JSON.stringify(check(text, f, py).diagnostics.map((d) => [d.code, d.line, d.message])));
    }
  } catch (e) {
    const d = (e as { diag?: { code: string; message: string; line: number } }).diag;
    problems.push(d ? `${d.code} line ${d.line}: ${d.message}` : String(e));
  }
  if (problems.length) {
    bad++;
    console.log(`${f}: ${problems.join("; ")}`);
  } else if (out) {
    writeFileSync(join(out, basename(f)), text);
  }
}
console.log(`${args.length - bad} of ${args.length} converted cleanly`);
