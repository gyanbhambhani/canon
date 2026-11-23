type Sale = { region: string; product: string; units: number; price_cents: number };

export function top_product_per_region(sales: Sale[]): [string, string, number][] {
  const byRegion = new Map<string, Map<string, number>>();
  for (const s of sales) {
    let m = byRegion.get(s.region);
    if (!m) {
      m = new Map();
      byRegion.set(s.region, m);
    }
    m.set(s.product, (m.get(s.product) ?? 0) + s.units * s.price_cents);
  }
  const regions = [...byRegion.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return regions.map((r) => {
    let best: [string, number] | null = null;
    for (const [p, v] of byRegion.get(r)!) {
      if (best === null || v > best[1] || (v === best[1] && p < best[0])) best = [p, v];
    }
    return [r, best![0], best![1]];
  });
}
