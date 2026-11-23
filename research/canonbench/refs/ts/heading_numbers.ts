export function heading_numbers(lines: string[]): string[] {
  const counters = [0, 0, 0];
  const out: string[] = [];
  for (const line of lines) {
    const m = /^(#{1,3}) (.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    counters[level - 1]++;
    for (let i = level; i < 3; i++) counters[i] = 0;
    out.push(counters.slice(0, level).join(".") + " " + m[2]);
  }
  return out;
}
