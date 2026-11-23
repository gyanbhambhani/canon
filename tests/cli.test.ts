/**
 * M4 acceptance: the `canon` command, run as a real process from packages/cli/dist
 * (pnpm test builds it first). Exit codes: 0 success, 1 diagnostics/failed tests/traps, 2 usage.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".cn")).sort();

function canon(args: string[], input = "") {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: "utf8", input });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function tmp(name: string, text: string) {
  const d = mkdtempSync(join(tmpdir(), "canon-cli-"));
  const f = join(d, name);
  writeFileSync(f, text);
  return f;
}

describe("canon run", () => {
  it("prints hello, canon", () => {
    expect(canon(["run", "examples/hello.cn"])).toEqual({ code: 0, out: "hello, canon\n", err: "" });
  });

  it("runs every example with its expected output", () => {
    for (const f of examples) {
      const r = canon(["run", `examples/${f}`]);
      expect(r.code, f + r.err).toBe(0);
      expect(r.out, f).toBe(readFileSync(join(root, "tests", "run", `example_${f.replace(".cn", ".out")}`), "utf8"));
    }
  });

  it("--json reports status and captured stdout", () => {
    const r = canon(["run", "examples/hello.cn", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ ok: true, status: 0, stdout: "hello, canon\n" });
  });

  it("a trap prints one JSON object on stderr and exits 1", () => {
    const f = tmp("trap.cn", "fn main() -> Unit {\n  assert(1 == 2)\n}\n");
    const r = canon(["run", f]);
    expect(r.code).toBe(1);
    const trap = JSON.parse(r.err);
    expect(trap).toMatchObject({ code: "R005", line: 2, col: 3 });
    expect(trap.stack[0].fn).toBe("main");
  });

  it("--deny net makes http_get trap with R006", () => {
    const f = tmp("net.cn", 'fn main() -> Unit\n  effects: net\n{\n  let r = http_get("http://127.0.0.1:9/")\n}\n');
    const r = canon(["run", f, "--deny", "net,fs"]);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.err)).toMatchObject({ code: "R006", line: 4 });
  });

  it("--no-contracts skips requires", () => {
    const f = tmp("c.cn", "fn f(n: Int) -> Int\n  requires: n > 0\n{\n  return n\n}\n\nfn main() -> Unit\n  effects: io\n{\n  print(to_string(f(0)))\n}\n");
    expect(JSON.parse(canon(["run", f]).err).code).toBe("R001");
    expect(canon(["run", f, "--no-contracts"])).toMatchObject({ code: 0, out: "0\n" });
  });

  it("an Err from main prints its message and exits 1", () => {
    const f = tmp("e.cn", 'fn main() -> Result[Int, Error] {\n  return Err(Error { message: "boom" })\n}\n');
    const r = canon(["run", f]);
    expect(r.code).toBe(1);
    expect(r.err).toBe("error: boom\n");
  });

  it("refuses to run a file with diagnostics", () => {
    const f = tmp("bad.cn", "fn main() -> Unit {\n  print(\"x\")\n}\n");
    const r = canon(["run", f]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("E101");
  });

  it("reads stdin for read_line", () => {
    const r = canon(["run", "tests/run/read_lines.cn"], "alpha\nbeta\n");
    expect(r).toMatchObject({ code: 0, out: "> alpha\n> beta\n2 lines\n" });
  });
});

describe("canon check", () => {
  it("passes every example", () => {
    for (const f of examples) expect(canon(["check", `examples/${f}`]), f).toMatchObject({ code: 0 });
  });

  it("--json prints the result object", () => {
    const r = canon(["check", "examples/hello.cn", "--json"]);
    expect(JSON.parse(r.out)).toEqual({ ok: true, canonical: true, diagnostics: [] });
  });

  it("reports diagnostics with a patch and exits 1", () => {
    const f = tmp("greet.cn", "fn greet(name: String) -> Unit {\n  print(name)\n}\n");
    const r = canon(["check", f, "--json"]);
    expect(r.code).toBe(1);
    const d = JSON.parse(r.out).diagnostics[0];
    expect(d.code).toBe("E101");
    expect(d.fix.diff).toContain("+  effects: io");
    const human = canon(["check", f]);
    expect(human.code).toBe(1);
    expect(human.out).toContain("E101");
    expect(human.out).toContain(":1:4");
  });

  it("checks several files at once", () => {
    const r = canon(["check", "examples/hello.cn", "examples/fizzbuzz.cn", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toHaveLength(2);
  });
});

describe("canon fmt", () => {
  it("prints the canonical form of every example unchanged", () => {
    for (const f of examples) {
      const r = canon(["fmt", `examples/${f}`]);
      expect(r.code, f).toBe(0);
      expect(r.out, f).toBe(readFileSync(join(root, "examples", f), "utf8"));
    }
  });

  it("formats a messy file, and --write rewrites it", () => {
    const f = tmp("messy.cn", "fn f()->Int{return 1}");
    expect(canon(["fmt", f])).toMatchObject({ code: 0, out: "fn f() -> Int {\n  return 1\n}\n" });
    expect(canon(["fmt", f, "--write"]).code).toBe(0);
    expect(readFileSync(f, "utf8")).toBe("fn f() -> Int {\n  return 1\n}\n");
  });

  it("--json reports whether the file changed", () => {
    const f = tmp("m.cn", "fn f()->Int{return 1}");
    expect(JSON.parse(canon(["fmt", f, "--json"]).out)).toEqual({ path: f, changed: true, formatted: "fn f() -> Int {\n  return 1\n}\n" });
  });

  it("matches the oracle on the orders example", () => {
    const f = join(mkdtempSync(join(tmpdir(), "canon-cli-")), "orders_messy.cn");
    copyFileSync(join(root, "reference", "examples", "orders_messy.cn"), f);
    expect(canon(["fmt", f]).out).toBe(readFileSync(join(root, "reference", "examples", "orders.cn"), "utf8"));
  });

  it("a parse error is a diagnostic: exit 1", () => {
    const f = tmp("p.cn", "fn f() {\n}\n");
    const r = canon(["fmt", f]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("P001");
  });
});

describe("canon test", () => {
  it("runs the test blocks of every example", () => {
    for (const f of examples.filter((x) => x !== "hello.cn")) {
      const r = canon(["test", `examples/${f}`]);
      expect(r.code, f + r.out + r.err).toBe(0);
      expect(r.out).toMatch(/\d+ passed, 0 failed/);
    }
  });

  it("a failing test exits 1 and --json lists results", () => {
    const f = tmp("t.cn", 'test "ok" {\n  assert(true)\n}\n\ntest "bad" {\n  assert(1 == 2)\n}\n');
    const r = canon(["test", f]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("FAIL bad");
    expect(r.out).toContain("1 passed, 1 failed");
    const j = JSON.parse(canon(["test", f, "--json"]).out);
    expect(j.passed).toBe(1);
    expect(j.failed).toBe(1);
    expect(j.tests[1]).toMatchObject({ name: "bad", passed: false, trap: { code: "R005" } });
  });

  it("uses the deterministic test host", () => {
    const f = tmp("time.cn", 'test "clock" {\n  assert(now() == 0)\n  sleep(5)\n  assert(now() == 5)\n}\n');
    expect(canon(["test", f]).code).toBe(0);
  });
});

describe("usage", () => {
  it("exits 2 on usage errors", () => {
    expect(canon([]).code).toBe(2);
    expect(canon(["frobnicate", "x.cn"]).code).toBe(2);
    expect(canon(["run"]).code).toBe(2);
    expect(canon(["run", "examples/hello.cn", "--bogus"]).code).toBe(2);
    expect(canon(["run", "examples/hello.cn", "--deny", "disk"]).code).toBe(2);
    expect(canon(["run", "does/not/exist.cn"]).code).toBe(2);
    expect(canon(["fmt", "examples/hello.cn", "--deny", "net"]).code).toBe(2);
  });

  it("--help and --version exit 0", () => {
    expect(canon(["--help"]).code).toBe(0);
    expect(canon(["--version"])).toMatchObject({ code: 0, out: "canon 0.4.1\n" });
  });
});

describe("canon test, several files", () => {
  it("keeps going past a file with diagnostics, and --json keeps printed output", () => {
    const bad = tmp("bad.cn", "fn f() -> Int {\n  return \"x\"\n}\n");
    const good = tmp("good.cn", 'test "prints" {\n  print("from a test")\n  assert(true)\n}\n');
    const r = canon(["test", bad, good]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("PASS prints");
    expect(r.out).toContain("1 passed, 0 failed, 1 file with errors");
    const j = JSON.parse(canon(["test", good, "--json"]).out);
    expect(j).toMatchObject({ ok: true, passed: 1, failed: 0, stdout: "from a test\n" });
  });
});

describe("v0.3 flags", () => {
  it("check --fix applies mechanical patches and reports only judgment errors", () => {
    const f = tmp("fixme.cn", "fn greet(name: String) -> Unit {\n  print(name)\n}\n\nfn bad(n: Int) -> String {\n  return n\n}\n");
    const r = canon(["check", f, "--fix"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("applied E101 (not written; add --write)");
    expect(r.out).toContain("T001");
    expect(r.out).not.toContain("E101:");
    const j = JSON.parse(canon(["check", f, "--fix", "--json"]).out);
    expect(j.applied).toEqual(["E101"]);
    expect(j.diagnostics.map((d: { code: string }) => d.code)).toEqual(["T001"]);
    expect(j.diagnostics[0].data.suggestions[0].label).toBe("to_string(n)");
    expect(canon(["check", f, "--fix", "--write"]).code).toBe(1);
    expect(readFileSync(f, "utf8")).toContain("  effects: io\n");
  });

  it("check --fix exits 0 when every problem was mechanical", () => {
    const f = tmp("ok.cn", "fn half(n: Int) -> Float {\n  return n * 0.5\n}\n");
    expect(canon(["check", f, "--fix", "--write"]).code).toBe(0);
    expect(canon(["check", f]).code).toBe(0);
  });

  it("--write on check needs --fix", () => {
    expect(canon(["check", "examples/hello.cn", "--write"]).code).toBe(2);
  });

  it("every language switch is accepted, and --v0.2 restores v0.2 formatting", () => {
    const f = tmp("words.cn", "fn f(a: Bool, b: Bool) -> Bool {\n  return a and not b\n}\n");
    expect(canon(["fmt", f]).out).toContain("return a && !b");
    expect(canon(["fmt", f, "--no-symbols"]).out).toContain("return a and not b");
    expect(canon(["check", f, "--v0.2"]).code).toBe(0);
    for (const flag of ["--no-wrap", "--no-break", "--no-destructure", "--no-symbols", "--no-sealed-effects", "--no-suggestions"]) {
      expect(canon(["check", "examples/hello.cn", flag]).code, flag).toBe(0);
    }
  });

  it("v0.4: --syntax py prints Canon-Py, the default prints braces, and both read either surface", () => {
    const py = canon(["fmt", "examples/hello.cn", "--syntax", "py"]);
    expect(py).toEqual({ code: 0, out: '@effects(io)\ndef main() -> None:\n    print("hello, canon")\n', err: "" });
    const f = tmp("hello_py.cn", py.out);
    expect(canon(["fmt", f]).out).toBe(readFileSync(join(root, "examples", "hello.cn"), "utf8"));
    expect(canon(["check", f, "--syntax=py"]).code).toBe(0);
    expect(canon(["run", f, "--syntax", "py"])).toEqual({ code: 0, out: "hello, canon\n", err: "" });
    // brace syntax is the default: a Canon-Py file is not canonical there, and C001 says what to do
    const brace = canon(["check", f]);
    expect(brace.code).toBe(1);
    expect(brace.out).toContain("pass --syntax py");
    expect(canon(["fmt", f, "--syntax", "braces"]).code).toBe(2);
    expect(canon(["fmt", f, "--syntax", "brace"]).out).toContain("fn main() -> Unit");
    for (const flag of ["--v0.3", "--no-fn-effects"]) expect(canon(["check", "examples/hello.cn", flag]).code, flag).toBe(0);
    const ho = tmp("ho.cn", "fn apply(f: fn(String) -> Unit, s: String) -> Unit {\n  f(s)\n}\n\nfn main() -> Unit\n  effects: io\n{\n  apply(print, \"x\")\n}\n");
    expect(canon(["check", ho]).out).toContain("T011");
    expect(canon(["check", ho, "--v0.3"]).code).toBe(0);
  });

  it("canon test fuzzes contracts, and --no-contract-fuzz turns it off", () => {
    const f = tmp("fz.cn", "fn abs_diff(a: Int, b: Int) -> Int\n  ensures: result >= 0\n{\n  return a - b\n}\n");
    const r = canon(["test", f]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/FAIL fuzz abs_diff: a = -?\d+, b = -?\d+/);
    expect(r.out).toContain('"code":"R002"');
    expect(canon(["test", f, "--no-contract-fuzz"])).toMatchObject({ code: 0, out: "0 passed, 0 failed\n" });
  });

  it("a test that uses fs must declare it; the runtime guard enforces the declaration", () => {
    const f = tmp("fs.cn", 'test "writes"\n  effects: fs\n{\n  let r = write_file("/dev/null", "x")\n  assert(r == r)\n}\n');
    expect(canon(["test", f]).code).toBe(0);
    const undeclared = tmp("fs2.cn", 'test "writes" {\n  let r = write_file("/dev/null", "x")\n  assert(r == r)\n}\n');
    expect(canon(["test", undeclared]).err).toContain("E101");
    expect(canon(["test", undeclared, "--no-sealed-effects"]).code).toBe(0);
  });

  it("run accepts --no-capability-guard", () => {
    expect(canon(["run", "examples/hello.cn", "--no-capability-guard"])).toEqual({ code: 0, out: "hello, canon\n", err: "" });
  });
});
