type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function rle_decode(s: string): Result<string> {
  if (/^[0-9]/.test(s)) return { ok: false, error: "missing character before count" };
  let out = "";
  const re = /([^0-9])([0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[2] === "") out += m[1];
    else if (m[2][0] === "0") return { ok: false, error: "bad count for " + m[1] };
    else out += m[1].repeat(Number(m[2]));
  }
  return { ok: true, value: out };
}
