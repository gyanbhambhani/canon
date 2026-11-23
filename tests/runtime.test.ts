/** M3 acceptance: traps R001-R006, effect denial, contracts switch, deterministic test host, net. */
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryHost, runMain, testHost } from "@canon/runtime";
import { nodeHost } from "@canon/runtime/node";
import { compileOrThrow, run } from "./helpers/run";

const MAIN = (body: string, effects = "io") => `fn main() -> Unit\n  effects: ${effects}\n{\n${body}}\n`;

describe("traps", () => {
  it("R001: requires failed, at the requires clause, with a Canon stack", () => {
    const src = "fn f(n: Int) -> Int\n  requires: n > 0\n{\n  return n\n}\n\n" + MAIN("  print(to_string(f(0)))\n");
    const r = run(src);
    expect(r.status).toBe(1);
    expect(r.trap).toMatchObject({ code: "R001", line: 2, col: 13 });
    expect(r.trap!.message).toContain("fn f");
    expect(r.trap!.stack.map((f) => f.fn)).toEqual(["f", "main"]);
    expect(r.trap!.stack[1]).toMatchObject({ line: 10, col: 19 });
  });

  it("R002: ensures failed, with result bound to the return value", () => {
    const src = "fn f(n: Int) -> Int\n  ensures: result > n\n{\n  return n\n}\n\n" + MAIN("  print(to_string(f(1)))\n");
    expect(run(src).trap).toMatchObject({ code: "R002", line: 2, col: 12 });
  });

  it("R003: integer overflow beyond the 53-bit safe range", () => {
    const r = run(MAIN("  let big = 9007199254740991\n  print(to_string(big + 1))\n"));
    expect(r.trap).toMatchObject({ code: "R003", line: 5, col: 19 });
    expect(r.stdout).toBe("");
  });

  it("R003: overflow inside sum and pow", () => {
    expect(run(MAIN("  print(to_string(pow(2, 60)))\n")).trap).toMatchObject({ code: "R003", line: 4 });
    const viaSum = MAIN("  [9007199254740991, 1]\n    |> sum()\n    |> to_string()\n    |> print()\n");
    expect(run(viaSum).trap).toMatchObject({ code: "R003", line: 5 });
  });

  it("R004: division and modulo by zero, Int and Float", () => {
    const zero = "fn zero() -> Int {\n  return 0\n}\n\n";
    expect(run(zero + MAIN("  let x = 10 / zero()\n  print(to_string(x))\n")).trap).toMatchObject({ code: "R004", line: 8, col: 11 });
    expect(run(zero + MAIN("  print(to_string(10 % zero()))\n")).trap).toMatchObject({ code: "R004", line: 8 });
    expect(run(MAIN("  let z = 0.0\n  print(to_string(1.0 / z))\n")).trap).toMatchObject({ code: "R004", line: 5 });
  });

  it("R005: assert failed", () => {
    const r = run(MAIN("  print(\"before\")\n  assert(1 == 2)\n  print(\"after\")\n"));
    expect(r.trap).toMatchObject({ code: "R005", line: 5, col: 3 });
    expect(r.stdout).toBe("before\n");
  });

  it("R006: effect denied by the host", () => {
    const mem = new MemoryHost();
    mem.denied = new Set(["io"]);
    const r = runMain(compileOrThrow(MAIN("  print(\"x\")\n")), mem);
    expect(r.trap).toMatchObject({ code: "R006", line: 4, col: 3 });
  });

  it("--deny net makes http_get trap with R006", () => {
    const out: string[] = [];
    const host = nodeHost({ deny: ["net"], write: (s) => out.push(s) });
    const js = compileOrThrow(MAIN('  let r = http_get("http://127.0.0.1:9/")\n  print("unreachable")\n', "io, net"));
    const r = runMain(js, host);
    expect(r.trap).toMatchObject({ code: "R006", line: 4, col: 11 });
    expect(r.trap!.message).toContain("net");
    expect(out).toEqual([]);
  });

  it("the trap JSON has code, message, line, col and stack", () => {
    const r = run("fn main() -> Unit {\n  assert(false)\n}\n");
    expect(Object.keys(r.trap!).sort()).toEqual(["code", "col", "line", "message", "stack"]);
    expect(r.trap!.stack[0]).toEqual({ fn: "main", line: 2, col: 3 });
  });
});

describe("contracts", () => {
  it("--no-contracts skips requires and ensures", () => {
    const src = "fn f(n: Int) -> Int\n  requires: n > 0\n  ensures: result > 5\n{\n  return n\n}\n\n" + MAIN("  print(to_string(f(0)))\n");
    expect(run(src).trap?.code).toBe("R001");
    const r = run(src, { contracts: false });
    expect(r.trap).toBeUndefined();
    expect(r.stdout).toBe("0\n");
  });
});

describe("test host", () => {
  it("now() starts at 0 and advances only through sleep; random() is seeded", () => {
    const src = MAIN(
      "  print(to_string(now()))\n  sleep(40)\n  print(to_string(now()))\n  print(to_string(random()))\n  print(to_string(random_int(0, 1000)))\n",
      "io, rand, time",
    );
    const a = run(src);
    const b = run(src);
    expect(a.stdout).toBe(b.stdout);
    const lines = a.stdout.split("\n");
    expect(lines.slice(0, 2)).toEqual(["0", "40"]);
    const f = Number(lines[2]);
    expect(f >= 0 && f < 1).toBe(true);
  });

  it("a fresh test host gives the same sequence every time", () => {
    const h1 = testHost(new MemoryHost());
    const h2 = testHost(new MemoryHost());
    expect([h1.random(), h1.random(), h1.now()]).toEqual([h2.random(), h2.random(), 0]);
  });
});

describe("main", () => {
  it("an Err from main prints its message and exits with status 1", () => {
    const r = run('fn main() -> Result[Int, Error] {\n  return Err(Error { message: "boom" })\n}\n');
    expect(r.status).toBe(1);
    expect(r.error).toBe("boom");
    expect(r.trap).toBeUndefined();
  });

  it("an Ok from main exits with status 0", () => {
    expect(run("fn main() -> Result[Int, Error] {\n  return Ok(1)\n}\n").status).toBe(0);
  });
});

describe("net through the node host", () => {
  // The node host performs requests synchronously in a child process, which blocks this
  // process's event loop, so the server must run in a process of its own.
  const SERVER = `
    const s = require("node:http").createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => res.end(req.method === "POST" ? "got " + body : "pong"));
    });
    s.listen(0, "127.0.0.1", () => console.log(s.address().port));
  `;
  let server: ChildProcess;
  let url = "";
  beforeAll(async () => {
    server = spawn(process.execPath, ["-e", SERVER], { stdio: ["ignore", "pipe", "inherit"] });
    const port = await new Promise<string>((resolve) => server.stdout!.once("data", (d) => resolve(String(d).trim())));
    url = `http://127.0.0.1:${port}/`;
  });
  afterAll(() => {
    server.kill();
  });

  it("http_get and http_post return Ok bodies", () => {
    const out: string[] = [];
    const body =
      `  let a = http_get("${url}")\n  let b = http_post("${url}", "ping")\n` +
      "  print(to_string(a))\n  print(to_string(b))\n";
    const r = runMain(compileOrThrow(MAIN(body, "io, net")), nodeHost({ write: (s) => out.push(s) }));
    expect(r).toEqual({ status: 0 });
    expect(out.join("")).toBe('Ok("pong")\nOk("got ping")\n');
  });
});

describe("embedding", () => {
  it("a loaded module exposes every user function by name", async () => {
    const { Runtime, load } = await import("@canon/runtime");
    const js = compileOrThrow("fn add(a: Int, b: Int) -> Int {\n  return a + b\n}\n");
    const mod = load(js, new Runtime(testHost(new MemoryHost())));
    expect(mod.fns.add(2, 3)).toBe(5);
  });
});
