export function rle_compress(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += s[i] + (j - i >= 2 ? String(j - i) : "");
    i = j;
  }
  return out.length < s.length ? out : s;
}
