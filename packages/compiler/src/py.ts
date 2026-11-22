/** Helpers that reproduce Python behaviour the oracle relies on. */

/** Python repr() of a str. */
export function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch !== " " && /[\p{C}\p{Z}]/u.test(ch)) {
      if (cp < 0x100) out += "\\x" + cp.toString(16).padStart(2, "0");
      else if (cp < 0x10000) out += "\\u" + cp.toString(16).padStart(4, "0");
      else out += "\\U" + cp.toString(16).padStart(8, "0");
    } else out += ch;
  }
  return out + quote;
}

/** Python repr() of a finite float (the 'r' format with Py_DTSF_ADD_DOT_0). */
export function pyFloatRepr(v: number): string {
  if (!Number.isFinite(v)) throw new RangeError(String(v));
  if (v === 0) return Object.is(v, -0) ? "-0.0" : "0.0";
  const neg = v < 0;
  const [mant, expS] = Math.abs(v).toExponential().split("e");
  const digits = mant.replace(".", "");
  const decpt = Number(expS) + 1; // value = 0.DIGITS * 10^decpt
  let s: string;
  if (decpt <= -4 || decpt > 16) {
    const e = decpt - 1;
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    const es = Math.abs(e).toString().padStart(2, "0");
    s = `${m}e${e < 0 ? "-" : "+"}${es}`;
  } else if (decpt <= 0) {
    s = "0." + "0".repeat(-decpt) + digits;
  } else if (decpt >= digits.length) {
    s = digits + "0".repeat(decpt - digits.length) + ".0";
  } else {
    s = digits.slice(0, decpt) + "." + digits.slice(decpt);
  }
  return neg ? "-" + s : s;
}

const LINE_BREAKS = new Set(["\n", "\r", "\x0b", "\x0c", "\x1c", "\x1d", "\x1e", "\x85", " ", " "]);

/** Python str.splitlines(keepends). */
export function pySplitlines(s: string, keepends = false): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (LINE_BREAKS.has(c)) {
      let end = i + 1;
      if (c === "\r" && s[i + 1] === "\n") end = i + 2;
      out.push(keepends ? s.slice(start, end) : s.slice(start, i));
      start = end;
      i = end;
    } else i++;
  }
  if (start < s.length) out.push(s.slice(start));
  return out;
}

/** Length in code points, as Python len(str). */
export function pyLen(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** Python str.rstrip() (Unicode whitespace). */
export function pyRstrip(s: string): string {
  // eslint-disable-next-line no-control-regex -- Python's whitespace set includes \x1c-\x1f
  return s.replace(/[\s\x1c-\x1f\x85]+$/u, "");
}

/**
 * Source text as the oracle sees it: Python's open() in text mode translates
 * \r\n and lone \r to \n (universal newlines). Every tool reads files through this.
 */
export function readSource(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
