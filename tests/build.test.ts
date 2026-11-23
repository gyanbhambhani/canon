/**
 * v0.4: `canon build FILE [-o OUT] [--module] [--json]` writes a standalone JavaScript file that
 * runs with plain `node` and no installed dependencies, and prints exactly what `canon run` prints.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".cn")).sort();

function canon(args: string[], cwd = root, input = "") {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", input });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** Run a built file with plain node, from a directory with no node_modules. */
function node(file: string, input = "") {
  const r = spawnSync(process.execPath, [file], { cwd: tmpdir(), encoding: "utf8", input });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const dir = () => mkdtempSync(join(tmpdir(), "canon-build-"));

describe("canon build", () => {
  it("builds every example to a standalone file that prints what canon run prints", () => {
    const d = dir();
    for (const f of examples) {
      const out = join(d, f.replace(/\.cn$/, ".js"));
      const b = canon(["build", `examples/${f}`, "-o", out]);
      expect(b.code, f + b.err).toBe(0);
      expect(readFileSync(out, "utf8")).not.toMatch(/require\(["']@canon|from ["']@canon/);
      const ran = node(out);
      const ref = canon(["run", `examples/${f}`]);
      expect(ran, f).toEqual(ref);
    }
  });

  it("defaults OUT to FILE with .js", () => {
    const d = dir();
    const src = join(d, "hi.cn");
    writeFileSync(src, readFileSync(join(root, "examples", "hello.cn")));
    expect(canon(["build", src]).code).toBe(0);
    expect(node(join(d, "hi.js")).out).toBe("hello, canon\n");
  });

  it("a trap prints the same JSON as canon run and exits 1", () => {
    const d = dir();
    const src = join(d, "trap.cn");
    writeFileSync(src, "fn main() -> Unit {\n  let x = 1 / 0\n}\n");
    expect(canon(["build", src]).code).toBe(0);
    const ran = node(join(d, "trap.js"));
    const ref = canon(["run", src]);
    expect(ran.code).toBe(1);
    expect(ran).toEqual(ref);
    expect(JSON.parse(ran.err)).toMatchObject({ code: "R004" });
  });

  it("an Err from main and stdin behave as under canon run", () => {
    const d = dir();
    const src = join(d, "io.cn");
    writeFileSync(src, 'fn main() -> Result[Unit, Error]\n  effects: io\n{\n  let line = read_line()\n  print(unwrap_or(line, "none"))\n  return Err(Error { message: "stopped" })\n}\n');
    expect(canon(["build", src]).code).toBe(0);
    expect(node(join(d, "io.js"), "typed\n")).toEqual(canon(["run", src], root, "typed\n"));
    expect(node(join(d, "io.js"), "typed\n")).toMatchObject({ code: 1, out: "typed\n", err: "error: stopped\n" });
  });

  it("bakes in --deny and --no-contracts only when given at build time", () => {
    const d = dir();
    const src = join(d, "c.cn");
    writeFileSync(src, "fn half(n: Int) -> Int\n  requires: n >= 0\n{\n  return n / 2\n}\n\nfn main() -> Unit\n  effects: io\n{\n  print(to_string(half(-4)))\n}\n");
    expect(canon(["build", src, "-o", join(d, "on.js")]).code).toBe(0);
    expect(node(join(d, "on.js"))).toMatchObject({ code: 1 });
    expect(canon(["build", src, "-o", join(d, "off.js"), "--no-contracts"]).code).toBe(0);
    expect(node(join(d, "off.js"))).toEqual({ code: 0, out: "-2\n", err: "" });
    const net = join(d, "net.cn");
    writeFileSync(net, 'fn main() -> Unit\n  effects: io, net\n{\n  let r = http_get("http://127.0.0.1:9/")\n  print("unreachable")\n}\n');
    expect(canon(["build", net, "-o", join(d, "net.js"), "--deny", "net"]).code).toBe(0);
    const ran = node(join(d, "net.js"));
    expect(ran.code).toBe(1);
    expect(JSON.parse(ran.err)).toMatchObject({ code: "R006" });
  });

  it("--module emits an ES module whose fns can be imported and called", async () => {
    const d = dir();
    const src = join(d, "lib.cn");
    writeFileSync(src, "fn double(n: Int) -> Int {\n  return n * 2\n}\n");
    const b = canon(["build", src, "--module"]);
    expect(b.code, b.err).toBe(0);
    const out = join(d, "lib.mjs");
    expect(existsSync(out)).toBe(true);
    const mod = await import(pathToFileURL(out).href);
    expect(mod.fns.double(21)).toBe(42);
    // and the same from a plain node process
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import { fns } from ${JSON.stringify(pathToFileURL(out).href)}; console.log(fns.double(5))`], { encoding: "utf8" });
    expect(r.stdout).toBe("10\n");
  });

  it("refuses a file with diagnostics (exit 1, nothing written), and reports usage errors (exit 2)", () => {
    const d = dir();
    const src = join(d, "bad.cn");
    writeFileSync(src, "fn main() -> Unit {\n  print(1)\n}\n");
    const r = canon(["build", src]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("E101");
    expect(existsSync(join(d, "bad.js"))).toBe(false);
    expect(canon(["build"]).code).toBe(2);
    expect(canon(["build", join(d, "missing.cn")]).code).toBe(2);
    expect(canon(["build", src, "-o"]).code).toBe(2);
    expect(canon(["build", "examples/hello.cn", "examples/fizzbuzz.cn"]).code).toBe(2);
  });

  it("--json reports what was written", () => {
    const d = dir();
    const out = join(d, "h.js");
    const r = canon(["build", "examples/hello.cn", "-o", out, "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ ok: true, out, module: false });
    const bad = join(d, "bad.cn");
    writeFileSync(bad, "fn main() -> Unit {\n  print(1)\n}\n");
    const j = canon(["build", bad, "--json"]);
    expect(j.code).toBe(1);
    expect(JSON.parse(j.out)).toMatchObject({ ok: false });
  });
});
