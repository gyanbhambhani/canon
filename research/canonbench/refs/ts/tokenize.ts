type Token =
  | { kind: "Num"; value: number }
  | { kind: "Ident"; name: string }
  | { kind: "Sym"; text: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function tokenize(s: string): Result<Token[]> {
  const out: Token[] = [];
  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isStart = (c: string) => (c >= "a" && c <= "z") || c === "_";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    if (c === " ") i++;
    else if (isDigit(c)) {
      let j = i;
      while (j < s.length && isDigit(s[j])) j++;
      out.push({ kind: "Num", value: Number(s.slice(i, j)) });
      i = j;
    } else if (isStart(c)) {
      let j = i;
      while (j < s.length && (isStart(s[j]) || isDigit(s[j]))) j++;
      out.push({ kind: "Ident", name: s.slice(i, j) });
      i = j;
    } else if (["==", "<=", ">=", "!="].includes(two)) {
      out.push({ kind: "Sym", text: two });
      i += 2;
    } else if ("+-*/=<>(),".includes(c)) {
      out.push({ kind: "Sym", text: c });
      i++;
    } else return { ok: false, error: "unexpected character: " + c + " at " + i };
  }
  return { ok: true, value: out };
}
