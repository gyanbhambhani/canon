import { readFileSync } from "node:fs";
import { httpPost } from "./http";

export interface Summary {
  count: number;
  total: number;
  peak: number;
}

export function parse_samples(text: string): number[] {
  const samples: number[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (/^-?\d+$/.test(t)) samples.push(Number(t));
  }
  return samples;
}

export function summarize(samples: number[]): Summary {
  return {
    count: samples.length,
    total: samples.reduce((a, b) => a + b, 0),
    peak: samples.reduce((m, x) => Math.max(m, x), 0),
  };
}

export function encode_summary(name: string, count: number, total: number, peak: number, ts: number): string {
  return [name, String(count), String(total), String(peak), String(ts)].join(" ");
}

export function read_samples(path: string): number[] {
  try {
    return parse_samples(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

export function should_sample(rate_percent: number): boolean {
  return Math.random() * 100 < rate_percent;
}

export function push_summary(url: string, name: string, path: string): boolean {
  const s = summarize(read_samples(path));
  if (s.count === 0) return false;
  const line = encode_summary(name, s.count, s.total, s.peak, Date.now());
  try {
    httpPost(url, line);
    return true;
  } catch {
    return false;
  }
}

export function maybe_push(url: string, name: string, path: string, rate_percent: number): boolean {
  if (!should_sample(rate_percent)) return false;
  return push_summary(url, name, path);
}
