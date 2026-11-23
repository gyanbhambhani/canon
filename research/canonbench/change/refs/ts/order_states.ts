type OrderEvent =
  | { kind: "Create"; id: string }
  | { kind: "Pay"; id: string }
  | { kind: "Ship"; id: string }
  | { kind: "Cancel"; id: string }
  | { kind: "Refund"; id: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function order_states(events: OrderEvent[]): Result<[string, string][]> {
  const states = new Map<string, string>();
  const rules: Record<string, [string[], string]> = {
    Pay: [["created"], "paid"],
    Ship: [["paid"], "shipped"],
    Cancel: [["created", "paid"], "cancelled"],
    Refund: [["paid", "shipped"], "refunded"],
  };
  for (const e of events) {
    const cur = states.get(e.id);
    if (e.kind === "Create") {
      if (cur !== undefined) return { ok: false, error: "duplicate order: " + e.id };
      states.set(e.id, "created");
      continue;
    }
    if (cur === undefined) return { ok: false, error: "unknown order: " + e.id };
    const [from, to] = rules[e.kind];
    if (!from.includes(cur)) return { ok: false, error: "cannot " + e.kind.toLowerCase() + " " + e.id + " from " + cur };
    states.set(e.id, to);
  }
  const out = [...states.entries()];
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { ok: true, value: out };
}
