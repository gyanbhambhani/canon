import { readFileSync, writeFileSync } from "node:fs";
import { httpGet } from "./http";

export interface Entry {
  fetched_at: number;
  body: string;
}

export function cache_path(dir: string, url: string): string {
  return dir + "/" + url.split("://").join("_").split("/").join("_");
}

export function encode_entry(fetched_at: number, body: string): string {
  return String(fetched_at) + "\n" + body;
}

export function decode_entry(text: string): Entry | null {
  const lines = text.split("\n");
  if (!/^-?\d+$/.test(lines[0])) return null;
  return { fetched_at: Number(lines[0]), body: lines.slice(1).join("\n") };
}

export function is_expired(fetched_at: number, now_ms: number, ttl_ms: number): boolean {
  return now_ms - fetched_at > ttl_ms;
}

export function read_cached(dir: string, url: string, ttl_ms: number): string | null {
  let entry: Entry | null;
  try {
    entry = decode_entry(readFileSync(cache_path(dir, url), "utf8"));
  } catch {
    return null;
  }
  if (entry === null) return null;
  return if_fresh(entry.fetched_at, entry.body, ttl_ms);
}

export function if_fresh(fetched_at: number, body: string, ttl_ms: number): string | null {
  if (is_expired(fetched_at, Date.now(), ttl_ms)) return null;
  return body;
}

export function fetch_and_store(dir: string, url: string): string {
  const body = httpGet(url);
  writeFileSync(cache_path(dir, url), encode_entry(Date.now(), body));
  return body;
}

export function get_cached(dir: string, url: string, ttl_ms: number): string {
  return read_cached(dir, url, ttl_ms) ?? fetch_and_store(dir, url);
}
