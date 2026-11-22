/**
 * Apply a unified diff (as produced by the checker) to the text it was computed against.
 * Returns null if any hunk's context does not match. Used by the browser playground.
 *
 * The diff is read with the source lines in hand: a context or removed line is matched by
 * the exact source line, which may lack its trailing newline. Python's difflib (whose output
 * the checker reproduces byte for byte) writes such a line with no "\ No newline" marker, so
 * it runs straight into the next diff line; reading by known length handles that.
 */
import { pySplitlines } from "./py.js";

export function applyPatch(src: string, diff: string): string | null {
  const lines = pySplitlines(src, true);
  const out: string[] = [];
  let pos = 0;
  let p = diff.indexOf("@@");
  if (p < 0) return src;
  const readLine = () => {
    const nl = diff.indexOf("\n", p);
    const end = nl < 0 ? diff.length : nl + 1;
    const s = diff.slice(p, end);
    p = end;
    return s;
  };
  while (p < diff.length) {
    const header = readLine();
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);
    if (!m) return null;
    let oldStart = Number(m[1]);
    if (m[2] !== undefined && Number(m[2]) === 0) oldStart += 1; // "-N,0" inserts after line N
    while (pos < oldStart - 1) {
      if (pos >= lines.length) return null;
      out.push(lines[pos++]);
    }
    while (p < diff.length && !diff.startsWith("@@", p)) {
      const tag = diff[p];
      if (tag === " " || tag === "-") {
        const want = lines[pos];
        if (want === undefined || !diff.startsWith(want, p + 1)) return null;
        p += 1 + want.length;
        pos++;
        if (tag === " ") out.push(want);
      } else if (tag === "+") {
        p += 1;
        out.push(readLine());
      } else if (tag === "\\") {
        readLine();
      } else {
        return null;
      }
    }
  }
  while (pos < lines.length) out.push(lines[pos++]);
  return out.join("");
}
