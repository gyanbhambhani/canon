import { readFileSync } from "node:fs";
import { httpPost } from "./http";

export interface Job {
  name: string;
  interval_s: number;
  last_run: number;
}

export function parse_job(line: string): Job | null {
  const parts = line.split(",").map((p) => p.trim());
  if (parts.length !== 3) return null;
  if (!/^-?\d+$/.test(parts[1]) || !/^-?\d+$/.test(parts[2])) return null;
  return { name: parts[0], interval_s: Number(parts[1]), last_run: Number(parts[2]) };
}

export function parse_jobs(text: string): Job[] {
  const jobs: Job[] = [];
  for (const line of text.split("\n")) {
    const job = parse_job(line);
    if (job !== null) jobs.push(job);
  }
  return jobs;
}

export function next_run(interval_s: number, last_run: number): number {
  return last_run + interval_s * 1000;
}

export function is_due(interval_s: number, last_run: number, now_ms: number): boolean {
  return now_ms >= next_run(interval_s, last_run);
}

export function due_jobs(path: string): string[] {
  let jobs: Job[] = [];
  try {
    jobs = parse_jobs(readFileSync(path, "utf8"));
  } catch {
    jobs = [];
  }
  const now_ms = Date.now();
  return jobs.filter((j) => is_due(j.interval_s, j.last_run, now_ms)).map((j) => j.name);
}

export function trigger(api: string, name: string): boolean {
  try {
    httpPost(api + "/jobs/" + name + "/run", "");
    return true;
  } catch {
    return false;
  }
}

export function run_due(path: string, api: string): number {
  let started = 0;
  for (const name of due_jobs(path)) {
    if (trigger(api, name)) started++;
  }
  return started;
}
