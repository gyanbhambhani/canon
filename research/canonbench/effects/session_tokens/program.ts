export function token_alphabet(): string[] {
  return "0123456789abcdef".split("");
}

export function pick_char(index: number): string {
  const alphabet = token_alphabet();
  return alphabet[index % alphabet.length];
}

export function random_suffix(length: number): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += pick_char(Math.floor(Math.random() * token_alphabet().length));
  }
  return suffix;
}

export function encode_token(user: string, issued_at: number, suffix: string): string {
  return user + "." + String(issued_at) + "." + suffix;
}

export function issue_token(user: string): string {
  const issued_at = Date.now();
  return encode_token(user, issued_at, random_suffix(12));
}

export function token_expired(token: string, now_ms: number, ttl_ms: number): boolean {
  const parts = token.split(".");
  if (parts.length < 2) return true;
  const issued = /^-?\d+$/.test(parts[1]) ? Number(parts[1]) : 0;
  return now_ms - issued >= ttl_ms;
}

export function check_token(token: string, ttl_ms: number): boolean {
  return !token_expired(token, Date.now(), ttl_ms);
}

export function refresh_token(token: string, ttl_ms: number): string {
  if (check_token(token, ttl_ms)) return token;
  const user = token.split(".")[0];
  return issue_token(user);
}
