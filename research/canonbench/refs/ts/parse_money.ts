type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_money(s: string): Result<number> {
  const neg = s.startsWith("-");
  const rest = neg ? s.slice(1) : s;
  if (!rest.startsWith("$")) return { ok: false, error: "missing $" };
  const body = rest.slice(1);
  const dot = body.indexOf(".");
  const dollars = dot < 0 ? body : body.slice(0, dot);
  let cents = 0;
  if (dot >= 0) {
    const c = body.slice(dot + 1);
    if (!/^[0-9]{2}$/.test(c)) return { ok: false, error: "bad cents" };
    cents = Number(c);
  }
  const plain = dollars.replace(/,/g, "");
  const shapeOk = /^[0-9]+$/.test(dollars) || /^[0-9]{1,3}(,[0-9]{3})+$/.test(dollars);
  if (!shapeOk || (plain.length > 1 && plain[0] === "0")) return { ok: false, error: "bad dollars" };
  const total = Number(plain) * 100 + cents;
  return { ok: true, value: neg ? -total : total };
}
