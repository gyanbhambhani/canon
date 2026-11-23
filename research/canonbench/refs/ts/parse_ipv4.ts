type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_ipv4(s: string): Result<number> {
  const parts = s.split(".");
  if (parts.length !== 4) return { ok: false, error: "expected 4 parts" };
  let total = 0;
  for (const p of parts) {
    if (!/^[0-9]{1,3}$/.test(p) || (p.length > 1 && p[0] === "0") || Number(p) > 255) {
      return { ok: false, error: "bad part: " + p };
    }
    total = total * 256 + Number(p);
  }
  return { ok: true, value: total };
}
