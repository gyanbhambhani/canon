/**
 * The `canon` command: check, fmt, run, test. Exit codes: 0 success; 1 diagnostics, failed
 * tests or traps; 2 usage errors (unknown command or flag, missing or unreadable file).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CanonError, check, compileJs, fmt, readSource, VERSION, type CheckResult, type Diagnostic } from "@canon/compiler";
import { runMain, runTests, testHost, type Effect, type Host, type TrapJson } from "@canon/runtime";
import { nodeHost } from "@canon/runtime/node";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const EFFECTS: Effect[] = ["fs", "io", "net", "rand", "time"];

export const USAGE = `canon ${VERSION}: a programming language for AI agents

usage:
  canon check FILE...            check files; print diagnostics (with patches)
  canon fmt FILE... [--write]    print the canonical form, or rewrite files in place
  canon run FILE [--deny EFFECTS] [--no-contracts]
                                 check, then run fn main()
  canon test FILE...             run the test blocks (deterministic time and rand)

options:
  --json                         machine-readable output (every command)
  --deny fs,net                  make calls to those effects trap with R006 (run)
  --no-contracts                 skip requires/ensures checks (run)
  --help, --version

exit codes: 0 success, 1 diagnostics / failed tests / traps, 2 usage error
`;

class UsageError extends Error {}

interface Args {
  cmd: string;
  files: string[];
  json: boolean;
  write: boolean;
  deny: Effect[];
  contracts: boolean;
}

const ALLOWED: Record<string, string[]> = {
  check: ["--json"],
  fmt: ["--json", "--write"],
  run: ["--json", "--deny", "--no-contracts"],
  test: ["--json"],
};

function parseArgs(argv: string[]): Args {
  const [cmd, ...rest] = argv;
  if (!cmd || !(cmd in ALLOWED)) throw new UsageError(cmd ? `unknown command '${cmd}'` : "missing command");
  const a: Args = { cmd, files: [], json: false, write: false, deny: [], contracts: true };
  for (let i = 0; i < rest.length; i++) {
    const x = rest[i];
    if (!x.startsWith("--")) {
      a.files.push(x);
      continue;
    }
    const [flag, inline] = x.split("=", 2) as [string, string | undefined];
    if (!ALLOWED[cmd].includes(flag)) throw new UsageError(`unknown option '${flag}' for canon ${cmd}`);
    if (flag === "--json") a.json = true;
    else if (flag === "--write") a.write = true;
    else if (flag === "--no-contracts") a.contracts = false;
    else if (flag === "--deny") {
      const v = inline ?? rest[++i];
      if (!v) throw new UsageError("--deny needs a list of effects, like --deny net,fs");
      for (const e of v.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!EFFECTS.includes(e as Effect)) throw new UsageError(`unknown effect '${e}'; the effects are ${EFFECTS.join(", ")}`);
        a.deny.push(e as Effect);
      }
    }
  }
  if (a.files.length === 0) throw new UsageError(`canon ${cmd} needs a file`);
  if (cmd === "run" && a.files.length > 1) throw new UsageError("canon run takes one file");
  return a;
}

function readFile(path: string): string {
  if (!existsSync(path)) throw new UsageError(`no such file: ${path}`);
  try {
    return readSource(readFileSync(path, "utf8"));
  } catch (e) {
    throw new UsageError(`cannot read ${path}: ${(e as Error).message}`);
  }
}

export function formatDiagnostic(path: string, d: Diagnostic): string {
  let s = `${path}:${d.line}:${d.col}: ${d.severity} ${d.code}: ${d.message}\n`;
  if (d.data && d.code === "H001") {
    const data = d.data as { candidates?: string[] };
    if (data.candidates?.length) s += `  candidates:\n${data.candidates.map((c) => `    ${c}`).join("\n")}\n`;
  }
  if (d.fix) s += d.fix.diff.replace(/^/gm, "  ").replace(/ {2}$/, "");
  return s;
}

function report(path: string, r: CheckResult, io: CliIO, to: "stdout" | "stderr" = "stdout") {
  for (const d of r.diagnostics) io[to](formatDiagnostic(path, d));
  const n = r.diagnostics.length;
  io[to](n ? `${path}: ${n} problem${n === 1 ? "" : "s"}\n` : `${path}: ok\n`);
}

function trapText(t: TrapJson): string {
  return JSON.stringify(t) + "\n";
}

function cmdCheck(a: Args, io: CliIO): number {
  const results = a.files.map((f) => ({ path: f, result: check(readFile(f), f) }));
  if (a.json) {
    const out = results.length === 1 ? results[0].result : results.map((r) => ({ path: r.path, ...r.result }));
    io.stdout(JSON.stringify(out, null, 2) + "\n");
  } else {
    for (const r of results) report(r.path, r.result, io);
  }
  return results.every((r) => r.result.ok) ? 0 : 1;
}

function cmdFmt(a: Args, io: CliIO): number {
  let status = 0;
  const outs: unknown[] = [];
  for (const f of a.files) {
    const src = readFile(f);
    let formatted: string;
    try {
      formatted = fmt(src);
    } catch (e) {
      if (!(e instanceof CanonError)) throw e;
      status = 1;
      if (a.json) outs.push({ path: f, error: e.diag });
      else io.stderr(formatDiagnostic(f, e.diag));
      continue;
    }
    if (a.write && formatted !== src) writeFileSync(f, formatted);
    if (a.json) outs.push({ path: f, changed: formatted !== src, formatted });
    else if (!a.write) io.stdout(formatted);
  }
  if (a.json) io.stdout(JSON.stringify(outs.length === 1 ? outs[0] : outs, null, 2) + "\n");
  return status;
}

function compileFor(a: Args, path: string, io: CliIO): string | null {
  const c = compileJs(readFile(path), path);
  if (c.js) return c.js;
  if (a.json) io.stdout(JSON.stringify({ ok: false, diagnostics: c.check.diagnostics }, null, 2) + "\n");
  else report(path, c.check, io, "stderr");
  return null;
}

function cmdRun(a: Args, io: CliIO): number {
  const path = a.files[0];
  const js = compileFor(a, path, io);
  if (js === null) return 1;
  let captured = "";
  const host = nodeHost({ deny: a.deny, write: a.json ? (s) => (captured += s) : (s) => io.stdout(s) });
  const r = runMain(js, host, { contracts: a.contracts });
  if (a.json) {
    const out: Record<string, unknown> = { ok: r.status === 0, status: r.status, stdout: captured };
    if (r.trap) out.trap = r.trap;
    if (r.error) out.error = r.error;
    io.stdout(JSON.stringify(out, null, 2) + "\n");
    return r.status;
  }
  if (r.trap) io.stderr(trapText(r.trap));
  if (r.error) io.stderr(`error: ${r.error}\n`);
  return r.status;
}

function cmdTest(a: Args, io: CliIO): number {
  let passed = 0;
  let failed = 0;
  let broken = 0;
  const tests: unknown[] = [];
  let stdout = "";
  for (const path of a.files) {
    const js = compileFor(a, path, io);
    if (js === null) {
      broken++;
      continue;
    }
    const host: Host = testHost(nodeHost({ write: a.json ? (s) => (stdout += s) : (s) => io.stdout(s) }));
    for (const t of runTests(js, host)) {
      if (t.passed) passed++;
      else failed++;
      if (!a.json) io.stdout(t.passed ? `PASS ${t.name}\n` : `FAIL ${t.name}\n  ${trapText(t.trap!)}`);
      tests.push({ file: path, ...t });
    }
  }
  const ok = failed === 0 && broken === 0;
  if (a.json) {
    io.stdout(JSON.stringify({ ok, passed, failed, files_with_errors: broken, tests, stdout }, null, 2) + "\n");
  } else {
    io.stdout(`${passed} passed, ${failed} failed${broken ? `, ${broken} file${broken === 1 ? "" : "s"} with errors` : ""}\n`);
  }
  return ok ? 0 : 1;
}

export async function main(argv: string[], io: CliIO): Promise<number> {
  if (argv[0] === "--version" || argv[0] === "-v") {
    io.stdout(`canon ${VERSION}\n`);
    return 0;
  }
  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    io.stdout(USAGE);
    return 0;
  }
  try {
    const a = parseArgs(argv);
    switch (a.cmd) {
      case "check":
        return cmdCheck(a, io);
      case "fmt":
        return cmdFmt(a, io);
      case "run":
        return cmdRun(a, io);
      default:
        return cmdTest(a, io);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.stderr(`canon: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    throw e;
  }
}
