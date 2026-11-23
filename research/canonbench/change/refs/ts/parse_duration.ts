type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_duration(s: string): Result<number> {
  if (s === "") return { ok: false, error: "empty" };
  const units: Record<string, [number, number]> = { d: [1, 86400], h: [2, 3600], m: [3, 60], s: [4, 1] };
  let total = 0;
  let digits = "";
  let last = 0;
  for (const c of s) {
    if (c >= "0" && c <= "9") {
      digits += c;
      continue;
    }
    const u = units[c];
    if (!u) return { ok: false, error: "unknown unit: " + c };
    if (digits === "") return { ok: false, error: "missing number before " + c };
    if (u[0] <= last) return { ok: false, error: "unit out of order: " + c };
    total += Number(digits) * u[1];
    last = u[0];
    digits = "";
  }
  if (digits !== "") return { ok: false, error: "missing unit" };
  return { ok: true, value: total };
}
