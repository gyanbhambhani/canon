type Player = { name: string; score: number };

export function competition_rank(players: Player[]): [number, string][] {
  const sorted = [...players].sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return sorted.map((p) => [1 + players.filter((q) => q.score > p.score).length, p.name]);
}
