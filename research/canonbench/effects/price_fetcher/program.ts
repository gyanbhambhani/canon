import { httpGet } from "./http";

export interface Quote {
  symbol: string;
  price: number;
  fetched_at: number;
}

export function price_url(symbol: string): string {
  return "https://quotes.example.com/v1/price?symbol=" + symbol;
}

export function parse_price(body: string): number | null {
  const text = body.trim();
  const price = Number(text);
  return text === "" || Number.isNaN(price) ? null : price;
}

export function backoff_delay(attempt: number, base_ms: number): number {
  return base_ms * 2 ** attempt;
}

export function jittered_delay(attempt: number, base_ms: number): number {
  const delay = backoff_delay(attempt, base_ms);
  return delay + Math.floor(Math.random() * (Math.floor(delay / 2) + 1));
}

export function fetch_price_once(symbol: string): number | null {
  let body: string;
  try {
    body = httpGet(price_url(symbol));
  } catch {
    return null;
  }
  return parse_price(body);
}

export function fetch_price(symbol: string, retries: number): number | null {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const price = fetch_price_once(symbol);
    if (price !== null) return price;
    if (attempt < retries) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, jittered_delay(attempt, 100));
    }
  }
  return null;
}

export function fetch_quote(symbol: string, retries: number): Quote | null {
  const price = fetch_price(symbol, retries);
  if (price === null) return null;
  return { symbol, price, fetched_at: Date.now() };
}
