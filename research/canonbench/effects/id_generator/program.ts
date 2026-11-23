import { readFileSync, writeFileSync } from "node:fs";

export function compose_id(ms: number, worker: number, seq: number): number {
  return (ms - 1600000000000) * 4096 + worker * 64 + (seq % 64);
}

export function id_timestamp(id: number): number {
  return Math.floor(id / 4096) + 1600000000000;
}

export function id_worker(id: number): number {
  return Math.floor((id % 4096) / 64);
}

export function format_id(id: number): string {
  return "id-" + String(id);
}

export function new_id(worker: number): number {
  const ms = Date.now();
  return compose_id(ms, worker, Math.floor(Math.random() * 64));
}

export function next_sequence(path: string): number {
  let current = 0;
  try {
    const text = readFileSync(path, "utf8").trim();
    current = /^-?\d+$/.test(text) ? Number(text) : 0;
  } catch {
    current = 0;
  }
  writeFileSync(path, String(current + 1));
  return current + 1;
}

export function sequential_id(path: string, worker: number): number {
  const seq = next_sequence(path);
  return compose_id(Date.now(), worker, seq);
}

export function new_request_id(): string {
  return format_id(new_id(0));
}
