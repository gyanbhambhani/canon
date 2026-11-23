export function align_columns(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const r of rows) r.forEach((c, j) => (widths[j] = Math.max(widths[j] ?? 0, c.length)));
  return rows.map((r) => r.map((c, j) => c.padEnd(widths[j])).join(" | ").replace(/ +$/, ""));
}
