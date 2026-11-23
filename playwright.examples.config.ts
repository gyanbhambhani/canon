import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/**
 * v0.5 M6: the example apps end to end. Each runs its generated FastAPI backend (with a fresh
 * database) and its React frontend, which calls the generated client through Vite's /api proxy.
 * Needs `pnpm pyenv` and `pnpm build`.
 */
const root = dirname(fileURLToPath(import.meta.url));
const python = join(root, ".venv", "bin", "python");
const db = (name: string) => join(mkdtempSync(join(tmpdir(), `canon-e2e-${name}-`)), "canon.db");

const app = (name: string, backend: number, frontend: number, env: Record<string, string> = {}) => [
  {
    command: `${python} -m uvicorn main:app --port ${backend}`,
    cwd: join(root, "examples", name, "backend"),
    url: `http://127.0.0.1:${backend}/openapi.json`,
    env: { CANON_DATABASE: db(name), ...env },
    reuseExistingServer: false,
  },
  {
    command: `pnpm exec vite --port ${frontend} --strictPort --host 127.0.0.1`,
    cwd: join(root, "examples", name, "frontend"),
    url: `http://127.0.0.1:${frontend}`,
    env: { BACKEND_URL: `http://127.0.0.1:${backend}` },
    reuseExistingServer: false,
  },
];

export default defineConfig({
  testDir: "e2e/examples",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: { trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [...app("todos", 8101, 5101), ...app("shop", 8102, 5102, { CANON_FAKE_PAYMENTS: "1" })],
});
