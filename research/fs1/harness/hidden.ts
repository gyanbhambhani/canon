/**
 * Run the hidden suite on a working copy: the regression suite plus a task's hidden tests, over
 * HTTP (pytest) and through the arm's feature modules (client tests against a live server), plus
 * validation agreement. Returns every result and FS-1's metrics.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { FS1, PY } from "./arms";

export interface TaskInfo {
  id: string;
  kind: "feature" | "change";
  /** Regression tests this task replaces: pytest names (test_x) and client test ids. */
  supersedes?: string[];
  validation?: unknown[];
}

export interface TestResult {
  id: string;
  tags: string[];
  passed: boolean;
  error?: string;
}

export interface HiddenReport {
  results: TestResult[];
  validation: { feature: string; agreement?: number; samples?: number; error?: string }[];
  /** Every hidden test passed (task and regression). */
  pass: boolean;
  /** At least one boundary probe failed. */
  mismatch: boolean;
  regressionFailures: number;
  taskFailures: number;
}

const TSX = join(FS1, "node_modules", ".bin", "tsx");

export function loadTask(id: string): TaskInfo {
  return JSON.parse(readFileSync(join(FS1, "tasks", id, "task.json"), "utf8"));
}

function pytest(backend: string, files: string[], deselect: string[]): TestResult[] {
  const xml = join(mkdtempSync(join(tmpdir(), "fs1-junit-")), "out.xml");
  const args = ["-q", "-p", "no:cacheprovider", "--import-mode=importlib", `--junitxml=${xml}`, ...files];
  // superseded tests are regression tests (files[0]); node ids are relative to the root, and
  // (--deselect matches node-id prefixes: no regression test name may prefix another)
  for (const d of deselect) args.push("--deselect", `${relative(FS1, files[0])}::${d}`);
  spawnSync(join(PY, "pytest"), args, { cwd: FS1, encoding: "utf8", env: { ...process.env, FS1_BACKEND: backend }, timeout: 600_000 });
  if (!existsSync(xml)) return [{ id: "pytest", tags: ["http"], passed: false, error: "pytest did not run" }];
  const text = readFileSync(xml, "utf8");
  const out: TestResult[] = [];
  for (const m of text.matchAll(/<testcase classname="([^"]*)" name="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const body = m[4] ?? "";
    const failed = /<(failure|error)/.test(body);
    const regression = m[1].includes("regression");
    out.push({
      id: m[2], tags: ["http", regression ? "regression" : "task"], passed: !failed,
      ...(failed ? { error: (/message="([^"]*)"/.exec(body)?.[1] ?? "failed").slice(0, 500) } : {}),
    });
  }
  // an import error in a test file is a collection error: no testcase, one error
  if (!out.length) out.push({ id: "pytest collection", tags: ["http"], passed: false, error: text.slice(0, 500) });
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

async function clientTests(dir: string, files: string[], skip: string[], taskJson: string | null) {
  const port = await freePort();
  const db = join(mkdtempSync(join(tmpdir(), "fs1-live-")), "shop.db");
  const server = spawn(join(PY, "python"), ["-m", "uvicorn", "main:app", "--port", String(port), "--log-level", "error"], {
    cwd: join(dir, "backend"), env: { ...process.env, SHOP_DATABASE: db, SHOP_FAKE_PAYMENTS: "1" }, stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      try {
        await fetch(base + "/openapi.json");
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!up) return { results: [{ id: "server", tags: ["client"], passed: false, error: "the backend did not start" }], validation: [] };
    const args = ["--conditions=source", join(FS1, "harness", "client-runner.ts"), "--frontend", join(dir, "frontend"), "--base", base,
      "--tests", files.join(","), "--skip", skip.join(",")];
    if (taskJson) args.push("--validation", taskJson);
    const r = spawnSync(TSX, args, { cwd: FS1, encoding: "utf8", timeout: 900_000 });
    const line = (r.stdout ?? "").trim().split("\n").pop() ?? "";
    try {
      return JSON.parse(line) as { results: TestResult[]; validation: HiddenReport["validation"] };
    } catch {
      return { results: [{ id: "client runner", tags: ["client"], passed: false, error: (r.stderr || r.stdout || "no output").slice(0, 1000) }], validation: [] };
    }
  } finally {
    server.kill("SIGKILL");
  }
}

export async function runHidden(dir: string, task: TaskInfo | null): Promise<HiddenReport> {
  const reg = join(FS1, "harness", "regression");
  const taskDir = task ? join(FS1, "tasks", task.id, "hidden") : null;
  const supersedes = task?.supersedes ?? [];
  const httpFiles = [join(reg, "test_http.py"), ...(taskDir && existsSync(join(taskDir, "test_http.py")) ? [join(taskDir, "test_http.py")] : [])];
  const http = pytest(join(dir, "backend"), httpFiles, supersedes.filter((s) => s.startsWith("test_")));
  const clientFiles = [join(reg, "client.test.ts"), ...(taskDir && existsSync(join(taskDir, "client.test.ts")) ? [join(taskDir, "client.test.ts")] : [])];
  const client = await clientTests(dir, clientFiles, supersedes, task ? join(FS1, "tasks", task.id, "task.json") : null);
  const results = [...http, ...client.results.map((r) => ({ ...r, tags: r.tags.includes("regression") ? r.tags : [...r.tags, task ? "task" : "regression"] }))];
  return {
    results,
    validation: client.validation,
    pass: results.every((r) => r.passed),
    mismatch: results.some((r) => r.tags.includes("probe") && !r.passed),
    regressionFailures: results.filter((r) => r.tags.includes("regression") && !r.passed).length,
    taskFailures: results.filter((r) => r.tags.includes("task") && !r.passed).length,
  };
}
