type Session = { user: string; kind: string; time: number };

export function session_totals(events: Session[]): [string, number][] {
  const totals = new Map<string, number>();
  const open = new Map<string, number>();
  for (const e of events) {
    if (!totals.has(e.user)) totals.set(e.user, 0);
    if (e.kind === "login") {
      if (!open.has(e.user)) open.set(e.user, e.time);
    } else if (open.has(e.user)) {
      totals.set(e.user, totals.get(e.user)! + e.time - open.get(e.user)!);
      open.delete(e.user);
    }
  }
  const end = events.length ? events[events.length - 1].time : 0;
  for (const [u, t] of open) totals.set(u, totals.get(u)! + end - t);
  return [...totals].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
