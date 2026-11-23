type Stock = { sku: string; qty: number };
type Txn = { sku: string; delta: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function inventory_ledger(stock: Stock[], txns: Txn[]): Result<Stock[]> {
  const m = new Map<string, number>();
  for (const s of stock) m.set(s.sku, s.qty);
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    const cur = m.get(t.sku);
    if (cur === undefined) return { ok: false, error: "txn " + (i + 1) + ": unknown sku " + t.sku };
    const q = cur + t.delta;
    if (q < 0) return { ok: false, error: "txn " + (i + 1) + ": " + t.sku + " would go negative" };
    m.set(t.sku, q);
  }
  const out: Stock[] = [...m].filter((p) => p[1] > 0).map(([sku, qty]) => ({ sku, qty }));
  out.sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  return { ok: true, value: out };
}
