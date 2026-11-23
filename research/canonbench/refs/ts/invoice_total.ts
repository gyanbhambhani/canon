type Line = { sku: string; qty: number; unit_cents: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function invoice_total(lines: Line[], coupon: string): Result<number> {
  for (const l of lines) {
    if (l.qty < 1) return { ok: false, error: "bad quantity: " + l.sku };
  }
  let sub = 0;
  for (const l of lines) {
    const a = l.qty * l.unit_cents;
    sub += l.qty >= 10 ? a - Math.floor(a / 10) : a;
  }
  let amount: number;
  if (coupon === "") amount = sub;
  else if (coupon === "SAVE500") amount = Math.max(sub - 500, 0);
  else if (coupon === "PCT10") amount = sub - Math.floor(sub / 10);
  else if (coupon === "BIG20") {
    if (sub < 10000) return { ok: false, error: "coupon not applicable: BIG20" };
    amount = sub - Math.floor(sub / 5);
  } else return { ok: false, error: "unknown coupon: " + coupon };
  return { ok: true, value: amount + Math.floor((amount * 8 + 50) / 100) };
}
