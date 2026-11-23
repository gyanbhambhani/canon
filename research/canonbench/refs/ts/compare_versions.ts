type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function valid(v: string): boolean {
  const parts = v.split(".");
  return parts.length <= 4 && parts.every((p) => /^[0-9]+$/.test(p));
}

export function compare_versions(a: string, b: string): Result<number> {
  if (!valid(a)) return { ok: false, error: "bad version: " + a };
  if (!valid(b)) return { ok: false, error: "bad version: " + b };
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return { ok: true, value: p < q ? -1 : 1 };
  }
  return { ok: true, value: 0 };
}
