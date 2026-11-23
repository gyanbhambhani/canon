type Request = { endpoint: string; ms: number; status: number };

export function latency_report(entries: Request[]): [string, number, number, number][] {
  const groups = new Map<string, Request[]>();
  for (const e of entries) {
    const g = groups.get(e.endpoint);
    if (g) g.push(e);
    else groups.set(e.endpoint, [e]);
  }
  return [...groups].map(([ep, rs]) => {
    const n = rs.length;
    const k = Math.floor((9 * n + 9) / 10);
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    return [ep, n, ms[k - 1], rs.filter((r) => r.status >= 500).length];
  });
}
