export function k_most_frequent(xs: number[], k: number): [number, number][] {
  if (k <= 0) return [];
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const pairs: [number, number][] = [...counts.entries()];
  pairs.sort((p, q) => q[1] - p[1] || p[0] - q[0]);
  return pairs.slice(0, k);
}
