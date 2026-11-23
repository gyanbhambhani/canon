type Expense = { payer: string; amount_cents: number };

export function settle_debts(expenses: Expense[], people: string[]): [string, string, number][] {
  const n = people.length;
  const total = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const share = Math.floor(total / n);
  const extra = total % n;
  const bal = people.map((p, i) => {
    const paid = expenses.filter((e) => e.payer === p).reduce((a, e) => a + e.amount_cents, 0);
    return paid - share - (i < extra ? 1 : 0);
  });
  const out: [string, string, number][] = [];
  for (;;) {
    let d = -1;
    let c = -1;
    for (let i = 0; i < n; i++) {
      if (bal[i] < 0 && (d < 0 || bal[i] < bal[d])) d = i;
      if (bal[i] > 0 && (c < 0 || bal[i] > bal[c])) c = i;
    }
    if (d < 0 || c < 0) break;
    const amt = Math.min(-bal[d], bal[c]);
    out.push([people[d], people[c], amt]);
    bal[d] += amt;
    bal[c] -= amt;
  }
  return out;
}
