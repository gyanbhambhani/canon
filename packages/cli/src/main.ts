/**
 * The `canon` command: check, fmt, run, test, build. Exit codes: 0 success; 1 diagnostics, failed
 * tests or traps; 2 usage errors (unknown command or flag, missing or unreadable file).
 */
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, readFileSync, unwatchFile, watch as fsWatch, watchFile as pollFile, writeFileSync, type FSWatcher,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  CanonError, check, compileJs, fix, flagName, fmt, readSource, FEATURE_NAMES, V02, V03, VERSION,
  type CheckResult, type CompileOptions, type Diagnostic, type FeatureName, type Features,
} from "@canon/compiler";
import { fuzzContracts, runMain, runTests, testHost, type Effect, type Host, type TrapJson } from "@canon/runtime";
import { nodeHost } from "@canon/runtime/node";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const EFFECTS: Effect[] = ["fs", "io", "net", "rand", "time"];

export const USAGE = `canon ${VERSION}: a programming language for AI agents

usage:
  canon check FILE... [--fix [--write]]
                                 check files; print diagnostics (with patches)
  canon fmt FILE... [--write]    print the canonical form, or rewrite files in place
  canon run FILE [--deny EFFECTS] [--no-contracts]
                                 check, then run fn main()
  canon test FILE...             run the test blocks (deterministic time and rand),
                                 then fuzz every pure function that has a contract
  canon build FILE [-o OUT] [--module] [--deny EFFECTS] [--no-contracts]
                                 check, then write a standalone JavaScript file that
                                 runs with plain node (default OUT: FILE.js; with
                                 --module, an ES module exporting fns: FILE.mjs)

options:
  --json                         machine-readable output (every command)
  --watch                        rerun on every save of FILE until Ctrl-C (check, test, run, build)
  --fix                          apply every mechanical patch (C001, E101, E102, T009) until
                                 none is left; report only what needs judgment (check)
  --write                        with fmt or check --fix: rewrite the files
  --deny fs,net                  make calls to those effects trap with R006 (run, build)
  --no-contracts                 skip requires/ensures checks (run, build)
  --syntax brace|py              the surface fmt prints and diagnostics use (default: brace);
                                 both surfaces are always read, so fmt converts either way
  --help, --version

language versions and switches (for experiments):
  --v0.3, --v0.2                 the v0.3 or v0.2 language
  --no-wrap --no-break --no-destructure --no-symbols --no-sealed-effects --no-suggestions
  --no-fn-effects                each turns one v0.3 or v0.4 change off
  --no-capability-guard (run, test, build)    --no-contract-fuzz (test)

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
  fix: boolean;
  guard: boolean;
  fuzz: boolean;
  watch: boolean;
  module: boolean;
  out: string | null;
  features: Partial<Features>;
  /** argv without --watch (a watched run starts the CLI again with these). */
  passthrough: string[];
}

const LANG_FLAGS = ["--v0.2", "--v0.3", "--syntax", ...FEATURE_NAMES.map((f) => `--no-${flagName(f)}`)];

const ALLOWED: Record<string, string[]> = {
  check: ["--json", "--fix", "--write", "--watch", ...LANG_FLAGS],
  fmt: ["--json", "--write", ...LANG_FLAGS],
  run: ["--json", "--deny", "--no-contracts", "--no-capability-guard", "--watch", ...LANG_FLAGS],
  test: ["--json", "--no-capability-guard", "--no-contract-fuzz", "--watch", ...LANG_FLAGS],
  build: ["--json", "--deny", "--no-contracts", "--no-capability-guard", "--module", "-o", "--watch", ...LANG_FLAGS],
};

function parseArgs(argv: string[]): Args {
  const [cmd, ...rest] = argv;
  if (!cmd || !(cmd in ALLOWED)) throw new UsageError(cmd ? `unknown command '${cmd}'` : "missing command");
  const a: Args = {
    cmd, files: [], json: false, write: false, deny: [], contracts: true, fix: false, guard: true, fuzz: true,
    watch: false, module: false, out: null, features: {}, passthrough: [],
  };
  let syntax: boolean | null = null;
  for (let i = 0; i < rest.length; i++) {
    const x = rest[i];
    if (x !== "--watch") a.passthrough.push(x);
    if (x === "-o") {
      if (!ALLOWED[cmd].includes("-o")) throw new UsageError(`unknown option '-o' for canon ${cmd}`);
      const v = rest[++i];
      if (!v) throw new UsageError("-o needs an output file");
      a.passthrough.push(v);
      a.out = v;
      continue;
    }
    if (!x.startsWith("--")) {
      a.files.push(x);
      continue;
    }
    const [flag, inline] = x.split("=", 2) as [string, string | undefined];
    if (!ALLOWED[cmd].includes(flag)) throw new UsageError(`unknown option '${flag}' for canon ${cmd}`);
    if (flag === "--json") a.json = true;
    else if (flag === "--write") a.write = true;
    else if (flag === "--no-contracts") a.contracts = false;
    else if (flag === "--fix") a.fix = true;
    else if (flag === "--watch") a.watch = true;
    else if (flag === "--module") a.module = true;
    else if (flag === "--no-capability-guard") a.guard = false;
    else if (flag === "--no-contract-fuzz") a.fuzz = false;
    else if (flag === "--v0.2") a.features = { ...V02 };
    else if (flag === "--v0.3") a.features = { ...V03 };
    else if (flag === "--syntax") {
      const v = inline ?? rest[++i];
      if (inline === undefined && v !== undefined) a.passthrough.push(v);
      if (v !== "py" && v !== "brace") throw new UsageError("--syntax takes brace or py");
      syntax = v === "py";
    } else if (flag.startsWith("--no-")) {
      const f = FEATURE_NAMES.find((n) => `--no-${flagName(n)}` === flag) as FeatureName;
      a.features[f] = false;
    } else if (flag === "--deny") {
      const v = inline ?? rest[++i];
      if (inline === undefined && v !== undefined) a.passthrough.push(v);
      if (!v) throw new UsageError("--deny needs a list of effects, like --deny net,fs");
      for (const e of v.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!EFFECTS.includes(e as Effect)) throw new UsageError(`unknown effect '${e}'; the effects are ${EFFECTS.join(", ")}`);
        a.deny.push(e as Effect);
      }
    }
  }
  if (syntax !== null) a.features.py = syntax;
  if (a.files.length === 0) throw new UsageError(`canon ${cmd} needs a file`);
  if ((cmd === "run" || cmd === "build") && a.files.length > 1) throw new UsageError(`canon ${cmd} takes one file`);
  if (a.watch && a.files.length > 1) throw new UsageError("--watch takes one file");
  if (cmd === "check" && a.write && !a.fix) throw new UsageError("--write needs --fix (canon check --fix --write)");
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
  const sug = (d.data as { suggestions?: { label: string }[] } | undefined)?.suggestions;
  if (sug?.length) s += `  did you mean (patches in --json):\n${sug.map((c) => `    ${c.label}`).join("\n")}\n`;
  if (d.fix) s += d.fix.diff.replace(/^/gm, "  ").replace(/ {2}$/, "");
  return s;
}

const problems = (n: number) => (n ? `${n} problem${n === 1 ? "" : "s"}` : "ok");

function report(path: string, r: CheckResult, io: CliIO, to: "stdout" | "stderr" = "stdout") {
  for (const d of r.diagnostics) io[to](formatDiagnostic(path, d));
  io[to](`${path}: ${problems(r.diagnostics.length)}\n`);
}

function trapText(t: TrapJson): string {
  return JSON.stringify(t) + "\n";
}

const opts = (a: Args): CompileOptions => ({ features: a.features });

/** What one run of a command did, for the watch-mode status line. */
interface Outcome {
  code: number;
  summary: string;
}

/** Files this process wrote (check --fix --write), so a watcher can ignore its own saves. */
const ownWrites = new Map<string, string>();

function writeOwn(path: string, text: string) {
  ownWrites.set(resolve(path), text);
  writeFileSync(path, text);
}

function cmdCheck(a: Args, io: CliIO): Outcome {
  if (a.fix) return cmdFix(a, io);
  const results = a.files.map((f) => ({ path: f, result: check(readFile(f), f, opts(a)) }));
  if (a.json) {
    const out = results.length === 1 ? results[0].result : results.map((r) => ({ path: r.path, ...r.result }));
    io.stdout(JSON.stringify(out, null, 2) + "\n");
  } else {
    for (const r of results) report(r.path, r.result, io);
  }
  const n = results.reduce((s, r) => s + r.result.diagnostics.length, 0);
  return { code: results.every((r) => r.result.ok) ? 0 : 1, summary: problems(n) };
}

/** `check --fix`: the self-healing loop. Only diagnostics that need judgment are reported. */
function cmdFix(a: Args, io: CliIO): Outcome {
  const results = a.files.map((f) => {
    const src = readFile(f);
    const r = fix(src, f, opts(a));
    if (a.write && r.source !== src) writeOwn(f, r.source);
    return { path: f, ...r };
  });
  if (a.json) {
    const shape = (r: (typeof results)[number]) => ({ ...r.result, applied: r.applied, source: r.source });
    const out = results.length === 1 ? shape(results[0]) : results.map((r) => ({ path: r.path, ...shape(r) }));
    io.stdout(JSON.stringify(out, null, 2) + "\n");
  } else {
    for (const r of results) {
      if (r.applied.length) io.stdout(`${r.path}: applied ${r.applied.join(", ")}${a.write ? "" : " (not written; add --write)"}\n`);
      report(r.path, r.result, io);
    }
  }
  const n = results.reduce((s, r) => s + r.result.diagnostics.length, 0);
  return { code: results.every((r) => r.result.ok) ? 0 : 1, summary: problems(n) };
}

function cmdFmt(a: Args, io: CliIO): number {
  let status = 0;
  const outs: unknown[] = [];
  for (const f of a.files) {
    const src = readFile(f);
    let formatted: string;
    try {
      formatted = fmt(src, opts(a));
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
  const c = compileJs(readFile(path), path, opts(a));
  if (c.js) return c.js;
  if (a.json) io.stdout(JSON.stringify({ ok: false, diagnostics: c.check.diagnostics }, null, 2) + "\n");
  else report(path, c.check, io, "stderr");
  return null;
}

function cmdRun(a: Args, io: CliIO): Outcome {
  const path = a.files[0];
  const js = compileFor(a, path, io);
  if (js === null) return { code: 1, summary: "does not check" };
  let captured = "";
  const host = nodeHost({ deny: a.deny, write: a.json ? (s) => (captured += s) : (s) => io.stdout(s) });
  const r = runMain(js, host, { contracts: a.contracts, capabilityGuard: a.guard });
  if (a.json) {
    const out: Record<string, unknown> = { ok: r.status === 0, status: r.status, stdout: captured };
    if (r.trap) out.trap = r.trap;
    if (r.error) out.error = r.error;
    io.stdout(JSON.stringify(out, null, 2) + "\n");
  } else {
    if (r.trap) io.stderr(trapText(r.trap));
    if (r.error) io.stderr(`error: ${r.error}\n`);
  }
  return { code: r.status, summary: `exit ${r.status}` };
}

function cmdTest(a: Args, io: CliIO): Outcome {
  let passed = 0;
  let failed = 0;
  let broken = 0;
  let skipped = 0;
  const tests: unknown[] = [];
  let stdout = "";
  for (const path of a.files) {
    const js = compileFor(a, path, io);
    if (js === null) {
      broken++;
      continue;
    }
    const host: Host = testHost(nodeHost({ write: a.json ? (s) => (stdout += s) : (s) => io.stdout(s) }));
    // with --no-sealed-effects, tests are unchecked as in v0.2, so the guard does not apply to them
    const guard = a.guard && a.features.sealedEffects !== false;
    for (const t of runTests(js, host, { capabilityGuard: guard })) {
      if (t.passed) passed++;
      else failed++;
      if (!a.json) io.stdout(t.passed ? `PASS ${t.name}\n` : `FAIL ${t.name}\n  ${trapText(t.trap!)}`);
      tests.push({ file: path, ...t });
    }
    if (a.fuzz) {
      for (const z of fuzzContracts(js, testHost(nodeHost({ write: () => {} })), { capabilityGuard: a.guard })) {
        if (z.skipped) {
          skipped++;
          if (!a.json) io.stdout(`SKIP ${z.name} (${z.skipped})\n`);
          tests.push({ file: path, ...z });
          continue;
        }
        if (z.passed) passed++;
        else failed++;
        if (!a.json) {
          io.stdout(z.passed
            ? `PASS ${z.name} (${z.runs} inputs)\n`
            : `FAIL ${z.name}: ${z.counterexample!.args.join(", ")}\n  ${trapText(z.counterexample!.trap)}`);
        }
        tests.push({ file: path, ...z });
      }
    }
  }
  const ok = failed === 0 && broken === 0;
  const summary = `${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}${broken ? `, ${broken} file${broken === 1 ? "" : "s"} with errors` : ""}`;
  if (a.json) {
    io.stdout(JSON.stringify({ ok, passed, failed, skipped, files_with_errors: broken, tests, stdout }, null, 2) + "\n");
  } else {
    io.stdout(summary + "\n");
  }
  return { code: ok ? 0 : 1, summary };
}

// ---------------------------------------------------------------------------------- build

/** The runtime bundle (dist/runtime-standalone.js), built next to the CLI by `pnpm build`. */
function runtimeBundle(): string {
  for (const rel of ["./runtime-standalone.js", "../dist/runtime-standalone.js"]) {
    const url = new URL(rel, import.meta.url);
    if (existsSync(url)) return readFileSync(url, "utf8");
  }
  throw new Error("canon build: the runtime bundle (dist/runtime-standalone.js) is missing; run pnpm build");
}

function standaloneScript(js: string, a: Args, from: string): string {
  return [
    "#!/usr/bin/env node",
    `// Built by canon ${VERSION} from ${basename(from)}. Runs with plain node; needs no installed packages.`,
    runtimeBundle().trimEnd(),
    "(function () {",
    "  const rt = __canonRuntime;",
    `  const program = ${JSON.stringify(js)};`,
    `  const host = rt.nodeHost({ deny: ${JSON.stringify(a.deny)} });`,
    `  const r = rt.runMain(program, host, { contracts: ${a.contracts}, capabilityGuard: ${a.guard} });`,
    '  if (r.trap) process.stderr.write(JSON.stringify(r.trap) + "\\n");',
    '  if (r.error) process.stderr.write("error: " + r.error + "\\n");',
    "  process.exitCode = r.status;",
    "})();",
    "",
  ].join("\n");
}

function moduleText(js: string, a: Args, from: string): string {
  return [
    `// Built by canon ${VERSION} from ${basename(from)}: an ES module exporting the program's functions as fns.`,
    'import { createRequire as __canonCreateRequire } from "node:module";',
    "const require = __canonCreateRequire(import.meta.url);",
    runtimeBundle().trimEnd(),
    `const __canonRt = new __canonRuntime.Runtime(__canonRuntime.nodeHost({ deny: ${JSON.stringify(a.deny)} }), { contracts: ${a.contracts} });`,
    `const __canonModule = __canonRuntime.load(${JSON.stringify(js)}, __canonRt);`,
    "export const fns = __canonModule.fns;",
    "export default fns;",
    "",
  ].join("\n");
}

function cmdBuild(a: Args, io: CliIO): Outcome {
  const path = a.files[0];
  const js = compileFor(a, path, io);
  if (js === null) return { code: 1, summary: "does not check" };
  const out = a.out ?? path.replace(/\.cn$/, "") + (a.module ? ".mjs" : ".js");
  const text = a.module ? moduleText(js, a, path) : standaloneScript(js, a, path);
  try {
    // create the output folder if it does not exist yet (`-o dist/app.js`)
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, text);
    if (!a.module) chmodSync(out, 0o755);
  } catch (e) {
    const message = `cannot write ${out}: ${(e as Error).message}`;
    if (a.json) io.stdout(JSON.stringify({ ok: false, out, error: message }, null, 2) + "\n");
    else io.stderr(`${path}: ${message}\n`);
    return { code: 1, summary: message };
  }
  if (a.json) io.stdout(JSON.stringify({ ok: true, out, module: a.module, bytes: Buffer.byteLength(text) }, null, 2) + "\n");
  else io.stdout(`${path}: wrote ${out}\n`);
  return { code: 0, summary: `wrote ${out}` };
}

// ---------------------------------------------------------------------------------- watch

const clock = () => new Date().toTimeString().slice(0, 8);

/**
 * `--watch`: run once, then rerun on every save of the file (debounced by 100 ms) until SIGINT.
 * check, test and build run in this process; run starts a child process per save, so a new save
 * can stop a program that is still running (or looping forever). A save that leaves the file's
 * text unchanged (including the file check --fix --write just wrote) is ignored.
 */
function watchFile(a: Args, io: CliIO, once: () => Outcome): Promise<number> {
  const path = a.files[0];
  readFile(path); // usage error now if missing
  const full = resolve(path);
  let last: string | null = null;
  let child: ChildProcess | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const status = (s: string) => io.stdout(`[${clock()}] ${a.cmd} ${path}: ${s}\n`);
  const clear = () => {
    if (process.stdout.isTTY) io.stdout("\x1b[2J\x1b[H");
  };

  const rerun = () => {
    let text: string;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      status("file is missing; waiting for it");
      return;
    }
    if (text === last) return;
    last = text;
    clear();
    if (a.cmd === "run") {
      if (child) {
        child.removeAllListeners("exit");
        child.kill("SIGKILL");
      }
      status("started");
      const c = spawn(process.execPath, [process.argv[1], a.cmd, ...a.passthrough], { stdio: ["ignore", "pipe", "pipe"] });
      child = c;
      c.stdout!.on("data", (b: Buffer) => io.stdout(b.toString("utf8")));
      c.stderr!.on("data", (b: Buffer) => io.stderr(b.toString("utf8")));
      c.on("exit", (code) => {
        if (child === c) {
          child = null;
          status(`exit ${code ?? "killed"}`);
        }
      });
      return;
    }
    try {
      const summary = once().summary;
      // the command may have written the file (check --fix --write): that text is already handled
      const own = ownWrites.get(full);
      if (own !== undefined) {
        ownWrites.delete(full);
        last = own;
      }
      status(summary);
    } catch (e) {
      if (e instanceof UsageError) status(e.message);
      else throw e;
    }
  };

  return new Promise((done) => {

    const schedule = (_ev?: string, name?: string | Buffer | null) => {
      if (name && name.toString() !== basename(full)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        rerun();
      }, 100);
    };
    const watcher: FSWatcher = fsWatch(dirname(full), schedule);
    // file-system events can be dropped or coalesced under load; a slow stat poll backs them up
    // (the text comparison in rerun makes a duplicate trigger harmless)
    pollFile(full, { interval: 300 }, () => schedule());
    // the first run starts after the watchers, so a save made while it runs is not missed
    rerun();
    process.once("SIGINT", () => {
      watcher.close();
      unwatchFile(full);
      if (timer) clearTimeout(timer);
      if (child) {
        child.removeAllListeners("exit");
        child.kill("SIGKILL");
      }
      done(130);
    });
  });
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
    const once = (): Outcome => {
      switch (a.cmd) {
        case "check":
          return cmdCheck(a, io);
        case "run":
          return cmdRun(a, io);
        case "build":
          return cmdBuild(a, io);
        default:
          return cmdTest(a, io);
      }
    };
    if (a.cmd === "fmt") return cmdFmt(a, io);
    if (a.watch) return await watchFile(a, io, once);
    return once().code;
  } catch (e) {
    if (e instanceof UsageError) {
      io.stderr(`canon: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    throw e;
  }
}
