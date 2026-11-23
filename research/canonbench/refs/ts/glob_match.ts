export function glob_match(pattern: string, s: string): boolean {
  type Tok = { kind: "star" } | { kind: "any" } | { kind: "lit"; ch: string };
  const toks: Tok[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      if (i + 1 < pattern.length) toks.push({ kind: "lit", ch: pattern[++i] });
      else toks.push({ kind: "lit", ch: "\\" });
    } else if (c === "*") toks.push({ kind: "star" });
    else if (c === "?") toks.push({ kind: "any" });
    else toks.push({ kind: "lit", ch: c });
  }
  let row: boolean[] = [true, ...Array.from({ length: s.length }, () => false)];
  for (const t of toks) {
    const next: boolean[] = [];
    if (t.kind === "star") {
      let acc = false;
      for (const b of row) next.push((acc = acc || b));
    } else {
      next.push(false);
      for (let j = 1; j <= s.length; j++) next.push(row[j - 1] && (t.kind === "any" || s[j - 1] === t.ch));
    }
    row = next;
  }
  return row[s.length];
}
