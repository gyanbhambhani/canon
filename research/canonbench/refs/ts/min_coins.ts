export function min_coins(coins: number[], amount: number): [number, number[]] | null {
  if (amount < 0) return null;
  const best: (number | null)[] = [0];
  for (let a = 1; a <= amount; a++) {
    let b: number | null = null;
    for (const c of coins) {
      const p = a - c >= 0 ? best[a - c] : null;
      if (p !== null && p !== undefined && (b === null || p + 1 < b)) b = p + 1;
    }
    best.push(b);
  }
  if (best[amount] === null) return null;
  const used: number[] = [];
  let a = amount;
  const desc = [...coins].sort((x, y) => y - x);
  while (a > 0) {
    const need = (best[a] as number) - 1;
    const c = desc.find((c) => (used.length === 0 || c <= used[used.length - 1]) && a - c >= 0 && best[a - c] === need)!;
    used.push(c);
    a -= c;
  }
  return [used.length, used];
}
