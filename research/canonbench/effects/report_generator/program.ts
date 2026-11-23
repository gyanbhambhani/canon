import { readFileSync, writeFileSync } from "node:fs";

export interface Sale {
  region: string;
  cents: number;
}

export function parse_sale(line: string): Sale | null {
  const parts = line.split(",");
  if (parts.length !== 2) return null;
  const text = parts[1].trim();
  if (!/^-?\d+$/.test(text)) return null;
  return { region: parts[0].trim(), cents: Number(text) };
}

export function totals_by_region(sales_text: string): [string, number][] {
  const totals = new Map<string, number>();
  for (const line of sales_text.split("\n")) {
    const sale = parse_sale(line);
    if (sale !== null) totals.set(sale.region, (totals.get(sale.region) ?? 0) + sale.cents);
  }
  return [...totals.entries()];
}

export function format_timestamp(ms: number): string {
  return "generated at " + String(Math.floor(ms / 1000));
}

export function render_report(sales_text: string, generated_at: number): string {
  const lines = [format_timestamp(generated_at)];
  for (const [region, cents] of totals_by_region(sales_text)) {
    lines.push(region + ": " + String(cents));
  }
  return lines.join("\n");
}

export function build_report(sales_path: string): string {
  const text = readFileSync(sales_path, "utf8");
  return render_report(text, Date.now());
}

export function publish_report(sales_path: string, out_path: string): number {
  const report = build_report(sales_path);
  writeFileSync(out_path, report);
  return report.length;
}

export function report_is_recent(generated_at: number, max_age_ms: number): boolean {
  return Date.now() - generated_at <= max_age_ms;
}
