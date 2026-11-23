import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export function format_timestamp(ms: number): string {
  return "t=" + String(Math.floor(ms / 1000));
}

export function log_line(level: string, message: string, ms: number): string {
  return format_timestamp(ms) + " [" + level + "] " + message;
}

export function rotated_name(path: string, ms: number): string {
  return path + "." + String(Math.floor(ms / 1000));
}

export function should_rotate(text: string, max_lines: number): boolean {
  const lines = text.split("\n").filter((l) => l !== "");
  return lines.length > max_lines;
}

export function append_line(path: string, line: string): void {
  appendFileSync(path, line + "\n");
}

export function log_event(path: string, level: string, message: string): void {
  append_line(path, log_line(level, message, Date.now()));
}

export function rotate(path: string): string {
  const text = readFileSync(path, "utf8");
  const target = rotated_name(path, Date.now());
  writeFileSync(target, text);
  writeFileSync(path, "");
  return target;
}

export function rotate_if_needed(path: string, max_lines: number): boolean {
  const text = readFileSync(path, "utf8");
  if (should_rotate(text, max_lines)) {
    rotate(path);
    return true;
  }
  return false;
}
