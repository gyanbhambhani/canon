type Park = { kind: "Arrive"; plate: string; minute: number } | { kind: "Leave"; plate: string; minute: number };

export function parking_fees(events: Park[]): [string, number][] {
  const parked = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.kind === "Arrive") {
      if (!parked.has(e.plate)) parked.set(e.plate, e.minute);
    } else {
      const start = parked.get(e.plate);
      if (start === undefined) continue;
      parked.delete(e.plate);
      const d = e.minute - start;
      const fee = d <= 30 ? 0 : Math.min(1000, 200 * Math.ceil((d - 30) / 60));
      totals.set(e.plate, (totals.get(e.plate) ?? 0) + fee);
    }
  }
  return [...totals.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
