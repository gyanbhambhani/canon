type Event = { kind: "Coin"; cents: number } | { kind: "Select"; price: number } | { kind: "Refund" };

export function vending_machine(events: Event[]): string[] {
  const out: string[] = [];
  let credit = 0;
  for (const e of events) {
    if (e.kind === "Coin") {
      if ([5, 10, 25, 100].includes(e.cents)) credit += e.cents;
      else out.push("reject " + e.cents);
    } else if (e.kind === "Select") {
      if (credit >= e.price) {
        out.push("vend " + e.price + " change " + (credit - e.price));
        credit = 0;
      } else out.push("insufficient " + credit);
    } else if (credit > 0) {
      out.push("refund " + credit);
      credit = 0;
    }
  }
  if (credit > 0) out.push("refund " + credit);
  return out;
}
