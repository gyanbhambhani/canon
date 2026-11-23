type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_query(s: string): Result<[string, string][]> {
  const out: [string, string][] = [];
  for (const item of s.split("&")) {
    if (item === "") continue;
    const eq = item.indexOf("=");
    const rawKey = eq < 0 ? item : item.slice(0, eq);
    const rawValue = eq < 0 ? "" : item.slice(eq + 1);
    const key = rawKey.split("+").join(" ");
    const value = rawValue.split("+").join(" ");
    if (key === "") return { ok: false, error: "empty key: " + item };
    out.push([key, value]);
  }
  return { ok: true, value: out };
}
