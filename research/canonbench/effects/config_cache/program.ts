import { readFileSync } from "node:fs";

export function parse_line(line: string): [string, string] | null {
  const parts = line.split("=");
  if (parts.length !== 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

export function parse_config(text: string): Map<string, string> {
  const settings = new Map<string, string>();
  for (const line of text.split("\n")) {
    const pair = parse_line(line);
    if (pair !== null) settings.set(pair[0], pair[1]);
  }
  return settings;
}

export function fetch_from_cache(cache: Map<string, string>, key: string): string | null {
  return cache.get(key) ?? null;
}

export function cache_is_fresh(loaded_at: number, now_ms: number, ttl_ms: number): boolean {
  return now_ms - loaded_at < ttl_ms;
}

export function read_config(path: string): Map<string, string> {
  return parse_config(readFileSync(path, "utf8"));
}

export function get_setting(path: string, key: string, fallback: string): string {
  let settings: Map<string, string>;
  try {
    settings = read_config(path);
  } catch {
    return fallback;
  }
  return fetch_from_cache(settings, key) ?? fallback;
}

export function needs_reload(loaded_at: number, ttl_ms: number): boolean {
  return !cache_is_fresh(loaded_at, Date.now(), ttl_ms);
}

export function reload_if_stale(path: string, key: string, loaded_at: number, ttl_ms: number): string | null {
  if (needs_reload(loaded_at, ttl_ms)) return get_setting(path, key, "");
  return null;
}
