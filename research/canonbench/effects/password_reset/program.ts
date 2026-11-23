import { httpPost } from "./http";

export function reset_code(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += String(Math.floor(Math.random() * 10));
  }
  return code;
}

export function reset_link(base_url: string, user: string, code: string): string {
  return base_url + "/reset?user=" + user + "&code=" + code;
}

export function expires_at(issued_ms: number, ttl_minutes: number): number {
  return issued_ms + ttl_minutes * 60000;
}

export function code_valid(issued_ms: number, ttl_minutes: number, now_ms: number): boolean {
  return now_ms < expires_at(issued_ms, ttl_minutes);
}

export function email_body(user: string, link: string): string {
  return "to=" + user + "&subject=Reset your password&text=" + link;
}

export function send_email(api: string, body: string): boolean {
  try {
    httpPost(api + "/v1/messages", body);
    return true;
  } catch {
    return false;
  }
}

export function start_reset(api: string, base_url: string, user: string): number {
  const link = reset_link(base_url, user, reset_code());
  if (!send_email(api, email_body(user, link))) return 0;
  return expires_at(Date.now(), 30);
}

export function is_reset_valid(issued_ms: number, ttl_minutes: number): boolean {
  return code_valid(issued_ms, ttl_minutes, Date.now());
}
