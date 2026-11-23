export function anagram_groups(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const w of words) {
    const k = [...w].sort().join("");
    const g = groups.get(k);
    if (g) g.push(w);
    else groups.set(k, [w]);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}
