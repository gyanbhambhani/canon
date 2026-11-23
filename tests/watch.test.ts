/**
 * v0.4: `--watch` on check, test, run and build. Each test starts the real CLI, waits for output
 * lines (never fixed sleeps), rewrites the watched file, and stops the watcher with SIGINT.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const bin = join(root, "packages", "cli", "dist", "index.js");

interface Watcher {
  proc: ChildProcessWithoutNullStreams;
  out: () => string;
  /** Resolve when the output since `from` matches re. */
  waitFor: (re: RegExp, from?: number) => Promise<number>;
  stop: () => Promise<number | null>;
}

/** Watchers still running when a test ends (after a failure) are killed, so none outlive the suite. */
const live: ChildProcessWithoutNullStreams[] = [];
afterEach(() => {
  for (const p of live.splice(0)) if (p.exitCode === null) p.kill("SIGKILL");
});

function watch(args: string[]): Watcher {
  const proc = spawn(process.execPath, [bin, ...args], { cwd: root });
  live.push(proc);
  let text = "";
  const waiters: (() => void)[] = [];
  const onData = (b: Buffer) => {
    text += b.toString("utf8");
    for (const w of [...waiters]) w();
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);
  return {
    proc,
    out: () => text,
    waitFor: (re, from = 0) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${re}; output:\n${text}`)), 20_000);
        const check = () => {
          const m = re.exec(text.slice(from));
          if (m) {
            clearTimeout(timer);
            waiters.splice(waiters.indexOf(check), 1);
            resolve(from + m.index + m[0].length);
          }
        };
        waiters.push(check);
        check();
      }),
    stop: () =>
      new Promise((resolve) => {
        if (proc.exitCode !== null) return resolve(proc.exitCode);
        proc.on("exit", (code) => resolve(code));
        proc.kill("SIGINT");
      }),
  };
}

const tmp = (name: string, text: string) => {
  const f = join(mkdtempSync(join(tmpdir(), "canon-watch-")), name);
  writeFileSync(f, text);
  return f;
};

const HELLO = 'fn main() -> Unit\n  effects: io\n{\n  print("hello, watcher")\n}\n';
const BROKEN = 'fn main() -> Unit {\n  print("x")\n}\n';

describe("--watch", () => {
  it("check --watch reruns on each save, shows the error and then ok, and exits on SIGINT", async () => {
    const f = tmp("w.cn", HELLO);
    const w = watch(["check", "--watch", f]);
    let at = await w.waitFor(/w\.cn: ok/);
    writeFileSync(f, BROKEN);
    at = await w.waitFor(/E101/, at);
    at = await w.waitFor(/\[\d\d:\d\d:\d\d\] check .*w\.cn: 1 problem/, at);
    writeFileSync(f, HELLO);
    await w.waitFor(/w\.cn: ok/, at);
    expect(w.out()).toMatch(/\[\d\d:\d\d:\d\d\] check .*w\.cn/);
    expect(await w.stop()).toBe(130);
    expect(w.out()).not.toMatch(/Error:|at .*\.js:\d+/);
  }, 60_000);

  it("run --watch stops an infinite loop when the file changes and runs the new program", async () => {
    const f = tmp("loop.cn", "fn main() -> Unit {\n  var n = 0\n  while true {\n    n = n + 1\n  }\n}\n");
    const w = watch(["run", "--watch", f]);
    const at = await w.waitFor(/run .*loop\.cn/);
    writeFileSync(f, HELLO);
    await w.waitFor(/hello, watcher/, at);
    expect(await w.stop()).toBe(130);
  }, 60_000);

  it("check --watch --fix --write does not trigger itself in a loop", async () => {
    const f = tmp("fix.cn", BROKEN);
    const w = watch(["check", "--watch", "--fix", "--write", f]);
    const at = await w.waitFor(/applied E101/);
    await w.waitFor(/\] check .*fix\.cn: ok/, at);
    expect(readFileSync(f, "utf8")).toContain("effects: io");
    // a later save still triggers exactly one rerun
    const runsBefore = (w.out().match(/\] check /g) ?? []).length;
    writeFileSync(f, BROKEN);
    const at2 = await w.waitFor(/applied E101/, at);
    await w.waitFor(/\] check .*fix\.cn: ok/, at2);
    // give a self-trigger the chance to show up: wait for the debounce window to pass twice
    await new Promise((r) => setTimeout(r, 600));
    const runsAfter = (w.out().match(/\] check /g) ?? []).length;
    expect(runsAfter - runsBefore).toBe(1);
    expect(await w.stop()).toBe(130);
  }, 60_000);

  it("test --watch and build --watch rerun on change", async () => {
    const f = tmp("t.cn", 'fn one() -> Int {\n  return 1\n}\n\ntest "one" {\n  assert(one() == 1)\n}\n');
    const t = watch(["test", "--watch", f]);
    let at = await t.waitFor(/1 passed, 0 failed/);
    writeFileSync(f, 'fn one() -> Int {\n  return 2\n}\n\ntest "one" {\n  assert(one() == 1)\n}\n');
    await t.waitFor(/0 passed, 1 failed/, at);
    expect(await t.stop()).toBe(130);

    const g = tmp("b.cn", HELLO);
    const out = g.replace(/\.cn$/, ".js");
    const b = watch(["build", "--watch", g]);
    at = await b.waitFor(/build .*b\.cn/);
    expect(existsSync(out)).toBe(true);
    writeFileSync(g, HELLO.replace("hello, watcher", "rebuilt"));
    await b.waitFor(/build .*b\.cn/, at);
    expect(readFileSync(out, "utf8")).toContain("rebuilt");
    expect(await b.stop()).toBe(130);
  }, 60_000);
});
