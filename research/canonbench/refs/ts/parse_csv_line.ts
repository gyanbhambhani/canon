type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_csv_line(s: string): Result<string[]> {
  const fields: string[] = [];
  let cur = "";
  let state = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (state === 0 || state === 1) {
      if (c === ",") {
        fields.push(cur);
        cur = "";
        state = 0;
      } else if (c === '"') {
        if (state === 1) return { ok: false, error: "unexpected quote at " + i };
        state = 2;
      } else {
        cur += c;
        state = 1;
      }
    } else if (state === 2) {
      if (c === '"') state = 3;
      else cur += c;
    } else {
      if (c === '"') {
        cur += '"';
        state = 2;
      } else if (c === ",") {
        fields.push(cur);
        cur = "";
        state = 0;
      } else return { ok: false, error: "expected comma at " + i };
    }
  }
  if (state === 2) return { ok: false, error: "unterminated quote" };
  fields.push(cur);
  return { ok: true, value: fields };
}
