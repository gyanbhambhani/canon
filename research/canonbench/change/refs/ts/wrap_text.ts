export function wrap_text(s: string, width: number): string[] {
  const words: string[] = [];
  for (const w of s.split(" ")) {
    for (let i = 0; i < w.length; i += width) words.push(w.slice(i, i + width));
  }
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
