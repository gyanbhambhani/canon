type Meeting = { start: number; end: number };

export function free_slots(meetings: Meeting[], day_start: number, day_end: number): [number, number][] {
  const ms = meetings.filter((m) => m.end > m.start).sort((a, b) => a.start - b.start);
  const out: [number, number][] = [];
  let cur = day_start;
  for (const m of ms) {
    const s = Math.min(m.start, day_end);
    if (s > cur) out.push([cur, s]);
    cur = Math.max(cur, m.end);
  }
  if (day_end > cur) out.push([cur, day_end]);
  return out;
}
