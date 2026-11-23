export function caesar_shift(s: string, k: number): string {
  let out = "";
  for (const c of s) {
    if (c >= "a" && c <= "z") {
      const i = (((c.charCodeAt(0) - 97 + k) % 26) + 26) % 26;
      out += String.fromCharCode(97 + i);
    } else {
      out += c;
    }
  }
  return out;
}
