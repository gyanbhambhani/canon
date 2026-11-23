import { readFileSync, writeFileSync } from "node:fs";
import { httpGet } from "./http";

export function classify(latency_ms: number): string {
  if (latency_ms < 0) return "down";
  else if (latency_ms <= 1000) return "healthy";
  return "degraded";
}

export function status_line(url: string, latency_ms: number): string {
  return classify(latency_ms) + " " + url + " " + String(latency_ms);
}

export function parse_targets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

export function probe(url: string): number {
  const started = Date.now();
  try {
    httpGet(url + "/healthz");
  } catch {
    return -1;
  }
  return Date.now() - started;
}

export function check_all(urls: string[]): string[] {
  return urls.map((url) => status_line(url, probe(url)));
}

export function write_status(path: string, urls: string[]): number {
  const lines = check_all(urls);
  writeFileSync(path, lines.join("\n") + "\n");
  return lines.filter((l) => classify_of(l) !== "healthy").length;
}

export function classify_of(line: string): string {
  return line.split(" ")[0];
}

export function check_from_file(targets_path: string, status_path: string): number {
  const text = readFileSync(targets_path, "utf8");
  return write_status(status_path, parse_targets(text));
}
