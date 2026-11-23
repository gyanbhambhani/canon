/**
 * Loads API keys from the owner's main checkout (never copied into the worktree, never printed).
 */
import { existsSync, readFileSync } from "node:fs";

export const ENV_FILE = "/Users/gyanb/Desktop/canon/.env.local";

export function loadEnv(): void {
  if (!existsSync(ENV_FILE)) return;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
