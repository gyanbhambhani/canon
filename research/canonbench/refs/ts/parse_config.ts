type Setting = { section: string; key: string; value: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_config(lines: string[]): Result<Setting[]> {
  const out: Setting[] = [];
  let section = "";
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    const tag = "line " + (n + 1) + ": ";
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      const inner = line.length >= 2 && line.endsWith("]") ? line.slice(1, -1).trim() : "";
      if (inner === "") return { ok: false, error: tag + "bad header" };
      section = inner;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) return { ok: false, error: tag + "missing =" };
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "") return { ok: false, error: tag + "empty key" };
    const existing = out.find((x) => x.section === section && x.key === key);
    if (existing) existing.value = value;
    else out.push({ section, key, value });
  }
  return { ok: true, value: out };
}
