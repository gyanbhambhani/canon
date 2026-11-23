import { readFileSync, writeFileSync } from "node:fs";
import { httpPost } from "./http";

export function sign(body: string, secret: string): string {
  return "sig-" + String(body.length * 7 + secret.length * 13);
}

export function build_payload(event: string, sent_at: number): string {
  return "event=" + event + "&ts=" + String(sent_at);
}

export function signed_payload(event: string, secret: string, sent_at: number): string {
  const body = build_payload(event, sent_at);
  return body + "&sig=" + sign(body, secret);
}

export function post_once(url: string, body: string): boolean {
  try {
    return httpPost(url, body).trim() === "accepted";
  } catch {
    return false;
  }
}

export function send_webhook(url: string, event: string, secret: string): boolean {
  return post_once(url, signed_payload(event, secret, Date.now()));
}

export function send_with_retry(url: string, event: string, secret: string, attempts: number): number {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (send_webhook(url, event, secret)) return attempt;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * attempt);
  }
  return 0;
}

export function delivery_line(url: string, event: string, attempts: number): string {
  if (attempts === 0) return "FAILED " + event + " -> " + url;
  return "OK " + event + " -> " + url + " after " + String(attempts);
}

export function deliver(url: string, event: string, secret: string, log_path: string): boolean {
  const attempts = send_with_retry(url, event, secret, 3);
  let previous = "";
  try {
    previous = readFileSync(log_path, "utf8");
  } catch {
    previous = "";
  }
  try {
    writeFileSync(log_path, previous + delivery_line(url, event, attempts) + "\n");
  } catch {
    return false;
  }
  return attempts > 0;
}
