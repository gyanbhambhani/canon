import { readFileSync, writeFileSync } from "node:fs";
import { httpPost } from "./http";

export function base_name(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

export function backup_name(path: string, dir: string, ms: number): string {
  return dir + "/" + base_name(path) + ".bak." + String(ms);
}

export function fingerprint(text: string): number {
  return text.length * 31 + text.split("\n").length;
}

export function copy_file(src: string, dst: string): number {
  const text = readFileSync(src, "utf8");
  writeFileSync(dst, text);
  return fingerprint(text);
}

export function backup_file(src: string, dir: string): string {
  const target = backup_name(src, dir, Date.now());
  copy_file(src, target);
  return target;
}

export function upload_backup(path: string, url: string): string {
  const text = readFileSync(path, "utf8");
  return httpPost(url + "?name=" + base_name(path), text).trim();
}

export function verify_copy(src: string, dst: string): boolean {
  try {
    return fingerprint(readFileSync(src, "utf8")) === fingerprint(readFileSync(dst, "utf8"));
  } catch {
    return false;
  }
}

export function run_backup(src: string, dir: string, url: string): string {
  const target = backup_file(src, dir);
  if (!verify_copy(src, target)) throw new Error("backup does not match " + src);
  return upload_backup(target, url);
}
