export function find_all(s: string, pat: string): number[] {
  const out: number[] = [];
  if (pat === "") return out;
  for (let i = 0; i + pat.length <= s.length; i++) if (s.startsWith(pat, i)) out.push(i);
  return out;
}
