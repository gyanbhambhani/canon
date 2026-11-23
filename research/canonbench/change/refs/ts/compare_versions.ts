type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function stripPrefix(v: string): string {
  return v.startsWith("v") || v.startsWith("V") ? v.slice(1) : v;
}

function valid(v: string): boolean {
  const parts = v.split(".");
  return parts.length <= 4 && parts.every((p) => /^[0-9]+$/.test(p));
}

export function compare_versions(a: string, b: string): Result<number> {
  const sa = stripPrefix(a);
  const sb = stripPrefix(b);
  if (!valid(sa)) return { ok: false, error: "bad version: " + a };
  if (!valid(sb)) return { ok: false, error: "bad version: " + b };
  const x = sa.split(".").map(Number);
  const y = sb.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return { ok: true, value: p < q ? -1 : 1 };
  }
  return { ok: true, value: 0 };
}
