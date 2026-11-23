export function poker_hand(cards: string[]): string {
  const RANKS = "23456789TJQKA";
  if (cards.length !== 5 || new Set(cards).size !== 5) return "invalid";
  for (const c of cards) if (c.length !== 2 || !RANKS.includes(c[0]) || !"CDHS".includes(c[1])) return "invalid";
  const ranks = cards.map((c) => RANKS.indexOf(c[0])).sort((x, y) => x - y);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const distinct = new Set(ranks).size === 5;
  const straight = distinct && (ranks[4] - ranks[0] === 4 || ranks.join(",") === "0,1,2,3,12");
  const counts = [...new Set(ranks)].map((r) => ranks.filter((x) => x === r).length).sort((x, y) => y - x);
  if (straight && flush) return "straight flush";
  if (counts[0] === 4) return "four of a kind";
  if (counts[0] === 3 && counts[1] === 2) return "full house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "three of a kind";
  if (counts[0] === 2 && counts[1] === 2) return "two pair";
  if (counts[0] === 2) return "one pair";
  return "high card";
}
