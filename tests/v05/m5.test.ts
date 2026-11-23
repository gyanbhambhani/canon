/**
 * v0.5 M5 acceptance: drift protection (G001 in canon check; canon build refuses without --force),
 * canon build from canon.toml (both targets, one target, main.py once, stale files removed), and
 * canon dev (builds, serves with uvicorn --reload, rebuilds on save).
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pyTool } from "./helpers/py";

const root = join(__dirname, "..", "..");
const bin = join(root, "packages", "cli", "dist", "index.js");

function canon(args: string[], cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function copy(fixture: string): string {
  const d = mkdtempSync(join(tmpdir(), "canon-build-"));
  cpSync(join(__dirname, fixture, "canon.toml"), join(d, "canon.toml"));
  cpSync(join(__dirname, fixture, "canon"), join(d, "canon"), { recursive: true });
  return d;
}

const TODOS = "golden/todos";
const SHOP = "projects/shop";

describe("canon build from canon.toml", () => {
  it("writes the backend, the frontend and main.py, matching the golden files", () => {
    const d = copy(TODOS);
    const r = canon(["build"], d);
    expect(r.err).toBe("");
    expect(r.out).toBe("canon build: wrote 11 files\n");
    for (const f of ["models.py", "logic.py", "api.py"]) {
      expect(readFileSync(join(d, "backend/canon_generated", f), "utf8")).toBe(readFileSync(join(__dirname, TODOS, "expected/backend/canon_generated", f), "utf8"));
    }
    for (const f of ["types.ts", "validate.ts", "client.ts"]) {
      expect(readFileSync(join(d, "frontend/src/canon", f), "utf8")).toBe(readFileSync(join(__dirname, TODOS, "expected/frontend/src/canon", f), "utf8"));
    }
    expect(readFileSync(join(d, "backend/main.py"), "utf8")).toContain("app.include_router(router)");
    expect(canon(["build"], d).out).toBe("canon build: wrote 0 files, 11 unchanged\n");
  });

  it("--target builds one side; --json reports what was written", () => {
    const d = copy(TODOS);
    const r = canon(["build", "--target", "ts-client", "--json"], d);
    const j = JSON.parse(r.out);
    expect(j.ok).toBe(true);
    expect(j.written.sort()).toEqual(["frontend/src/canon/client.ts", "frontend/src/canon/runtime.ts", "frontend/src/canon/types.ts", "frontend/src/canon/validate.ts"]);
    expect(existsSync(join(d, "backend"))).toBe(false);
    expect(canon(["build", "--target", "django"], d).code).toBe(2);
  });

  it("main.py is created once and never overwritten", () => {
    const d = copy(TODOS);
    canon(["build"], d);
    writeFileSync(join(d, "backend/main.py"), "# mine\n");
    expect(canon(["build"], d).code).toBe(0);
    expect(readFileSync(join(d, "backend/main.py"), "utf8")).toBe("# mine\n");
    rmSync(join(d, "backend/main.py"));
    canon(["build"], d);
    expect(readFileSync(join(d, "backend/main.py"), "utf8")).toContain("FastAPI()");
  });

  it("a module that is gone takes its generated file with it", () => {
    const d = copy(SHOP);
    expect(canon(["build"], d).code).toBe(0);
    expect(existsSync(join(d, "backend/canon_generated/orders.py"))).toBe(true);
    rmSync(join(d, "canon/orders.cn"));
    const r = canon(["build"], d);
    expect(r.code).toBe(0);
    // orders.py, and net.py, which only orders needed
    expect(r.out).toContain("removed backend/canon_generated/net.py, backend/canon_generated/orders.py");
    expect(existsSync(join(d, "backend/canon_generated/orders.py"))).toBe(false);
  });

  it("a project that does not check builds nothing and exits 1", () => {
    const d = copy(TODOS);
    appendFileSync(join(d, "canon/todos.cn"), "\nfn broken() -> Int {\n  return \"x\"\n}\n");
    const r = canon(["build"], d);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/canon\/todos\.cn:\d+:\d+: error T001/);
    expect(existsSync(join(d, "backend"))).toBe(false);
  });

  it("G002: what the Python target cannot express stops the build, naming the function", () => {
    const d = copy(TODOS);
    appendFileSync(join(d, "canon/todos.cn"), "\nfn nested(xs: List[Option[Int]]) -> Bool {\n  return is_some(first(xs))\n}\n");
    const r = canon(["build"], d);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/error G002: the Python target cannot express an Option of an Option.*\(fn nested\)/);
  });

  it("a single file still builds to JavaScript as before", () => {
    const r = canon(["build", "examples/hello.cn", "-o", join(mkdtempSync(join(tmpdir(), "canon-js-")), "hello.js")], root);
    expect(r.code).toBe(0);
  });
});

describe("drift protection (G001)", () => {
  it("canon check reports a hand-edited generated file, naming its Canon source", () => {
    const d = copy(TODOS);
    canon(["build"], d);
    expect(canon(["check"], d).code).toBe(0);
    appendFileSync(join(d, "backend/canon_generated/logic.py"), "# a quick fix\n");
    const r = canon(["check"], d);
    expect(r.code).toBe(1);
    expect(r.out).toContain("backend/canon_generated/logic.py:1:1: error G001: backend/canon_generated/logic.py was edited by hand, but it is generated from canon/todos.cn");
    const j = JSON.parse(canon(["check", "--json"], d).out);
    expect(j.find((x: { path: string }) => x.path.endsWith("logic.py")).diagnostics[0].code).toBe("G001");
  });

  it("canon build refuses to overwrite it, writes nothing, and --force discards the edit", () => {
    const d = copy(TODOS);
    canon(["build"], d);
    const client = join(d, "frontend/src/canon/client.ts");
    writeFileSync(client, readFileSync(client, "utf8").replace("createClient", "makeClient"));
    appendFileSync(join(d, "canon/todos.cn"), "\nfn helper() -> Int {\n  return 1\n}\n");
    const before = readFileSync(join(d, "backend/canon_generated/logic.py"), "utf8");
    const r = canon(["build"], d);
    expect(r.code).toBe(1);
    expect(r.err).toContain("frontend/src/canon/client.ts:1:1: error G001");
    expect(r.err).toContain("canon build: nothing written");
    expect(readFileSync(join(d, "backend/canon_generated/logic.py"), "utf8")).toBe(before); // all or nothing
    const f = canon(["build", "--force"], d);
    expect(f.code).toBe(0);
    expect(readFileSync(client, "utf8")).toContain("createClient");
    expect(readFileSync(join(d, "backend/canon_generated/logic.py"), "utf8")).toContain("def helper() -> int:");
    expect(canon(["check"], d).code).toBe(0);
  });

  it("a file in an output folder that Canon did not write is not overwritten without --force", () => {
    const d = copy(TODOS);
    canon(["build", "--target", "fastapi"], d);
    writeFileSync(join(d, "frontend-placeholder"), "");
    writeFileSync(join(d, "backend/canon_generated/api.py"), "# my own api\n");
    const r = canon(["build"], d);
    expect(r.code).toBe(1);
    expect(r.err).toContain("backend/canon_generated/api.py exists and was not generated by Canon");
  });
});

async function freePort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => ok(p));
    });
  });
}

async function waitFor<T>(f: () => Promise<T | null>, ms: number): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const v = await f();
      if (v !== null) return v;
    } catch {
      // not yet
    }
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("canon dev", () => {
  it("builds, serves the backend with uvicorn, and rebuilds and reloads on save", async () => {
    const d = copy(TODOS);
    const port = await freePort();
    const child = spawn(process.execPath, [bin, "dev", "--port", String(port)], {
      cwd: d, env: { ...process.env, CANON_PYTHON: pyTool("python"), CANON_DATABASE: join(d, "dev.db") }, stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout!.on("data", (b: Buffer) => (log += b.toString()));
    child.stderr!.on("data", (b: Buffer) => (log += b.toString()));
    try {
      const url = `http://127.0.0.1:${port}`;
      const created = await waitFor(async () => {
        const r = await fetch(`${url}/todos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "milk" }) });
        return r.ok ? r.json() : null;
      }, 30_000);
      expect(created).toEqual({ id: 1, title: "milk", done: false });
      // a new endpoint, saved in the Canon source, is served after the rebuild and reload
      appendFileSync(join(d, "canon/todos.cn"), '\napi fn todo_count() -> Int\n  route: GET "/count"\n  effects: store(todos)\n{\n  return count(todos)\n}\n');
      const n = await waitFor(async () => {
        const r = await fetch(`${url}/count`);
        return r.ok ? r.json() : null;
      }, 30_000);
      expect(n).toBe(1);
      expect(readFileSync(join(d, "frontend/src/canon/client.ts"), "utf8")).toContain("todoCount");
      expect(log).toContain("canon dev: serving");
    } finally {
      child.kill("SIGINT");
      await new Promise((r) => child.once("exit", r));
    }
  }, 90_000);
});
