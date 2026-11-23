type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const VALS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const TABLE: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  for (const [v, sym] of TABLE) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

export function roman_to_int(s: string): Result<number> {
  if (s === "") return { ok: false, error: "empty" };
  for (const c of s) if (!(c in VALS)) return { ok: false, error: "invalid character: " + c };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALS[s[i]];
    const next = i + 1 < s.length ? VALS[s[i + 1]] : 0;
    total += v < next ? -v : v;
  }
  if (total < 1 || total > 3999 || toRoman(total) !== s) return { ok: false, error: "not canonical" };
  return { ok: true, value: total };
}
