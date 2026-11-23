type Match = { home: string; away: string; home_goals: number; away_goals: number };

export function league_table(matches: Match[]): [string, number, number, number][] {
  const order: string[] = [];
  const stats = new Map<string, { pts: number; gf: number; ga: number }>();
  const get = (t: string) => {
    let s = stats.get(t);
    if (!s) {
      s = { pts: 0, gf: 0, ga: 0 };
      stats.set(t, s);
      order.push(t);
    }
    return s;
  };
  for (const m of matches) {
    const h = get(m.home);
    const a = get(m.away);
    h.gf += m.home_goals;
    h.ga += m.away_goals;
    a.gf += m.away_goals;
    a.ga += m.home_goals;
    if (m.home_goals > m.away_goals) h.pts += 3;
    else if (m.home_goals < m.away_goals) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  const rows: [string, number, number, number][] = order.map((t) => {
    const s = stats.get(t)!;
    return [t, s.pts, s.gf - s.ga, s.gf];
  });
  rows.sort((x, y) => y[1] - x[1] || y[2] - x[2] || y[3] - x[3] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return rows;
}
