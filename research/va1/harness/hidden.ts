/**
 * The hidden suite of a working copy: the regression test, the task's HTTP tests (pytest), the
 * client wiring check and validation agreement against a live server. The gate ("completed") is
 * every HTTP test and the wiring check passing.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VA1, PY } from "./arms";

export interface TaskInfo {
  id: string;
  set: 1 | 2;
  title: string;
  adapted?: { for: string; reason: string } | null;
}

export interface Agreement {
  samples: number;
  agree: number;
  bounce: number;
  block: number;
  serverOther: number;
  clientRejects: number;
  serverRejects: number;
  byCategory: Record<string, { n: number; agree: number; bounce: number; block: number }>;
  server: Record<string, { n: number; ok: number; invalid: number; other: number }>;
  disagreements: unknown[];
}

export interface HiddenReport {
  http: { id: string; passed: boolean; error?: string }[];
  wiring: { ok: boolean; error?: string };
  agreement: Agreement | null;
  /** every HTTP test passed */
  httpPass: boolean;
  /** HTTP tests and wiring: the run is "completed" */
  pass: boolean;
}

const TSX = join(VA1, "node_modules", ".bin", "tsx");

export function loadTask(id: string): TaskInfo & Record<string, unknown> {
  return JSON.parse(readFileSync(join(VA1, "tasks", id, "task.json"), "utf8"));
}

function pytest(backend: string, files: string[]) {
  const xml = join(mkdtempSync(join(tmpdir(), "va1-junit-")), "out.xml");
  spawnSync(join(PY, "pytest"), ["-q", "-p", "no:cacheprovider", "--import-mode=importlib", `--junitxml=${xml}`, ...files], {
    cwd: VA1, encoding: "utf8", env: { ...process.env, VA1_BACKEND: backend }, timeout: 600_000,
  });
  if (!existsSync(xml)) return [{ id: "pytest", passed: false, error: "pytest did not run" }];
  const text = readFileSync(xml, "utf8");
  const out: { id: string; passed: boolean; error?: string }[] = [];
  for (const m of text.matchAll(/<testcase classname="([^"]*)" name="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const body = m[4] ?? "";
    const failed = /<(failure|error)/.test(body);
    out.push({ id: m[2], passed: !failed, ...(failed ? { error: (/message="([^"]*)"/.exec(body)?.[1] ?? "failed").slice(0, 500) } : {}) });
  }
  if (!out.length) out.push({ id: "pytest collection", passed: false, error: text.slice(0, 500) });
  return out;
}

async function freePort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => ok(p));
    });
  });
}

/** Start the arm's backend, run `fn` against it, stop it. Returns null if the backend does not start. */
export async function withServer<T>(dir: string, fn: (base: string) => Promise<T>): Promise<T | null> {
  const port = await freePort();
  const server = spawn(join(PY, "python"), ["-m", "uvicorn", "main:app", "--port", String(port), "--log-level", "error"], {
    cwd: join(dir, "backend"), env: { ...process.env }, stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      try {
        await fetch(base + "/ping");
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return up ? await fn(base) : null;
  } finally {
    server.kill("SIGKILL");
  }
}

/** The task's hidden suite (task = null: the visible regression suite only, no client checks). */
export async function runHidden(dir: string, task: TaskInfo | null, opts: { samples?: number } = {}): Promise<HiddenReport> {
  const taskDir = task ? join(VA1, "tasks", task.id) : null;
  const files = [join(VA1, "harness", "regression", "test_http.py")];
  if (taskDir && existsSync(join(taskDir, "hidden", "test_http.py"))) files.push(join(taskDir, "hidden", "test_http.py"));
  const http = pytest(join(dir, "backend"), files);
  const httpPass = http.every((r) => r.passed);
  if (!task) return { http, wiring: { ok: true }, agreement: null, httpPass, pass: httpPass };
  const run = await withServer(dir, async (base) => {
    const args = ["harness/client-runner.ts", "--frontend", join(dir, "frontend"), "--base", base, "--task", join(taskDir!, "task.json")];
    if (opts.samples) args.push("--samples", String(opts.samples));
    const r = spawnSync(TSX, args, { cwd: VA1, encoding: "utf8", timeout: 900_000 });
    const line = (r.stdout ?? "").trim().split("\n").pop() ?? "";
    try {
      return JSON.parse(line) as { wiring: HiddenReport["wiring"]; agreement: Agreement };
    } catch {
      return { wiring: { ok: false, error: `client runner: ${(r.stderr || r.stdout || "no output").slice(0, 600)}` }, agreement: null };
    }
  });
  const wiring = run?.wiring ?? { ok: false, error: "the backend did not start" };
  return { http, wiring, agreement: run?.agreement ?? null, httpPass, pass: httpPass && wiring.ok };
}
