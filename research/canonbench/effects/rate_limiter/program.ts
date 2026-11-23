import { readFileSync, writeFileSync } from "node:fs";

export interface Bucket {
  tokens: number;
  last_ms: number;
}

export function parse_bucket(text: string, capacity: number): Bucket {
  const fields = text.trim().split(",");
  if (fields.length !== 2 || !fields.every((f) => /^-?\d+$/.test(f))) {
    return { tokens: capacity, last_ms: 0 };
  }
  return { tokens: Number(fields[0]), last_ms: Number(fields[1]) };
}

export function encode_bucket(tokens: number, last_ms: number): string {
  return String(tokens) + "," + String(last_ms);
}

export function refill(tokens: number, last_ms: number, now_ms: number, rate_per_s: number, capacity: number): number {
  return Math.min(capacity, tokens + Math.floor(((now_ms - last_ms) * rate_per_s) / 1000));
}

export function wait_time_ms(tokens: number, rate_per_s: number): number {
  if (tokens > 0) return 0;
  return Math.floor(1000 / rate_per_s);
}

export function load_bucket(path: string, capacity: number): Bucket {
  try {
    return parse_bucket(readFileSync(path, "utf8"), capacity);
  } catch {
    return { tokens: capacity, last_ms: 0 };
  }
}

export function try_acquire(path: string, rate_per_s: number, capacity: number): boolean {
  const bucket = load_bucket(path, capacity);
  const now_ms = Date.now();
  const tokens = refill(bucket.tokens, bucket.last_ms, now_ms, rate_per_s, capacity);
  if (tokens < 1) return false;
  try {
    writeFileSync(path, encode_bucket(tokens - 1, now_ms));
  } catch {
    return false;
  }
  return true;
}

export function acquire_blocking(path: string, rate_per_s: number, capacity: number, max_waits: number): boolean {
  for (let waits = 0; waits <= max_waits; waits++) {
    if (try_acquire(path, rate_per_s, capacity)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait_time_ms(0, rate_per_s));
  }
  return false;
}
