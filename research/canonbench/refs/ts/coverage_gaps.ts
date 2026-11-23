type Shift = { worker: string; start_hour: number; end_hour: number };

export function coverage_gaps(shifts: Shift[], required: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < 24; h++) {
    const ws = new Set(shifts.filter((s) => s.start_hour <= h && h < s.end_hour).map((s) => s.worker));
    if (ws.size < required) out.push(h);
  }
  return out;
}
