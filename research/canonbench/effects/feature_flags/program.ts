import { readFileSync } from "node:fs";
import { httpGet } from "./http";

export interface Flag {
  name: string;
  percent: number;
}

export function parse_flag(line: string): Flag | null {
  const parts = line.split(":");
  if (parts.length !== 2) return null;
  const text = parts[1].trim();
  if (!/^-?\d+$/.test(text)) return null;
  return { name: parts[0].trim(), percent: Number(text) };
}

export function parse_flags(text: string): Flag[] {
  const flags: Flag[] = [];
  for (const line of text.split("\n")) {
    const flag = parse_flag(line);
    if (flag !== null) flags.push(flag);
  }
  return flags;
}

export function user_bucket(user_id: number, salt: number): number {
  return (user_id * 31 + salt * 17) % 100;
}

export function is_enabled_for(flags_text: string, name: string, user_id: number): boolean {
  const flag = parse_flags(flags_text).find((f) => f.name === name);
  return flag !== undefined && user_bucket(user_id, flag.percent) < flag.percent;
}

export function load_flags(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function fetch_flags(url: string): string {
  try {
    return httpGet(url);
  } catch {
    return "";
  }
}

export function flag_enabled(path: string, name: string, user_id: number): boolean {
  return is_enabled_for(load_flags(path), name, user_id);
}

export function sample_enabled(url: string, name: string): boolean {
  const flag = parse_flags(fetch_flags(url)).find((f) => f.name === name);
  return flag !== undefined && Math.floor(Math.random() * 100) < flag.percent;
}
