/**
 * The `canon` command: check, fmt, run, test, build. Exit codes: 0 success; 1 diagnostics, failed
 * tests or traps; 2 usage errors (unknown command or flag, missing or unreadable file).
 */
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unwatchFile, watch as fsWatch, watchFile as pollFile, writeFileSync, type FSWatcher,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import {
  CanonError, TargetError, analyze, applyPatch, buildOutputs, check, driftDiagnostics, manifest, manifestText, checkProject, compileJs, fix, flagName, fmt, linkProject, programText, readSource,
  withFeatures, FEATURE_NAMES, MECHANICAL_CODES, V02, V03, VERSION,
  type BuildTarget, type CheckResult, type CompileOptions, type Diagnostic, type Program, type FeatureName, type Features, type ProjectResult,
} from "@canon/compiler";
import { findProjectRoot, loadProject, projectOfFile, ProjectError, type Project } from "./project.js";
import { fuzzContracts, runMain, runTests, testHost, type Effect, type Host, type TrapJson } from "@canon/runtime";
import { nodeHost } from "@canon/runtime/node";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const EFFECTS: Effect[] = ["fs", "io", "net", "rand", "time"];

export const USAGE = `canon ${VERSION}: a programming language for AI agents

usage (in a project with canon.toml, check, test and manifest need no FILE):
  canon check FILE... [--fix [--write]]
                                 check files; print diagnostics (with patches)
  canon fmt FILE... [--write]    print the canonical form, or rewrite files in place
  canon run FILE [--deny EFFECTS] [--no-contracts]
                                 check, then run fn main()
  canon test FILE...             run the test blocks (deterministic time and rand),
                                 then fuzz every pure function that has a contract
  canon manifest [FILE]          list every endpoint (api fn) with its route, effects
                                 and validation rules
  canon build [--target fastapi|ts-client] [--force] [--watch]
                                 in a project: generate the FastAPI backend and the
                                 TypeScript client into the folders canon.toml names;
                                 refuses to overwrite hand-edited files without --force
  canon dev [--port 8000]        in a project: build on every save, and serve the
                                 backend with uvicorn --reload ($CANON_PYTHON)
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

/** Commands that take no file inside a project (v0.5). */
const PROJECT_CMDS = new Set(["check", "test", "manifest", "build", "dev"]);

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
  /** v0.5: canon build --target fastapi|ts-client */
  target: BuildTarget | null;
  /** v0.5: canon build --force overwrites hand-edited generated files */
  force: boolean;
  /** v0.5: canon dev --port */
  port: number;
}

const LANG_FLAGS = ["--v0.2", "--v0.3", "--syntax", ...FEATURE_NAMES.map((f) => `--no-${flagName(f)}`)];

const ALLOWED: Record<string, string[]> = {
  check: ["--json", "--fix", "--write", "--watch", ...LANG_FLAGS],
  fmt: ["--json", "--write", ...LANG_FLAGS],
  run: ["--json", "--deny", "--no-contracts", "--no-capability-guard", "--watch", ...LANG_FLAGS],
  test: ["--json", "--no-capability-guard", "--no-contract-fuzz", "--watch", ...LANG_FLAGS],
  build: ["--json", "--deny", "--no-contracts", "--no-capability-guard", "--module", "-o", "--watch", "--target", "--force", ...LANG_FLAGS],
  manifest: ["--json", ...LANG_FLAGS],
  dev: ["--port", "--target", ...LANG_FLAGS],
};

function parseArgs(argv: string[]): Args {
  const [cmd, ...rest] = argv;
  if (!cmd || !(cmd in ALLOWED)) throw new UsageError(cmd ? `unknown command '${cmd}'` : "missing command");
  const a: Args = {
    cmd, files: [], json: false, write: false, deny: [], contracts: true, fix: false, guard: true, fuzz: true,
    watch: false, module: false, out: null, features: {}, passthrough: [], target: null, force: false, port: 8000,
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
    else if (flag === "--force") a.force = true;
    else if (flag === "--target" || flag === "--port") {
      const v = inline ?? rest[++i];
      if (inline === undefined && v !== undefined) a.passthrough.push(v);
      if (flag === "--port") {
        if (!v || !/^\d+$/.test(v)) throw new UsageError("--port needs a number, like --port 8000");
        a.port = Number(v);
      } else {
        if (v !== "fastapi" && v !== "ts-client") throw new UsageError("--target takes fastapi or ts-client");
        a.target = v;
      }
    }
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
  // v0.5: check and test with no file work on the project around the current directory
  if (a.files.length === 0 && !PROJECT_CMDS.has(cmd)) throw new UsageError(`canon ${cmd} needs a file`);
  if ((cmd === "run" || cmd === "build") && a.files.length > 1) throw new UsageError(`canon ${cmd} takes one file`);
  if (a.watch && a.files.length > 1) throw new UsageError("--watch takes one file");
  if (a.watch && a.files.length === 0 && cmd !== "build") throw new UsageError(`canon ${cmd} --watch takes a file`);
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

// ---------------------------------------------------------------------------------- projects (v0.5)

function loadProjectOrUsage(root: string): Project {
  try {
    return loadProject(root);
  } catch (e) {
    if (e instanceof ProjectError) throw new UsageError(e.message);
    throw e;
  }
}

interface Scope {
  project: Project;
  /** Absolute paths of the files named on the command line (null: the whole project). */
  only: Set<string> | null;
}

/** The project this command works on, or null for plain single-file mode. */
function projectScope(a: Args): Scope | null {
  try {
    if (a.files.length === 0) {
      const root = findProjectRoot(process.cwd());
      if (!root) throw new UsageError(`canon ${a.cmd} needs a file, or a project: run it in a folder with canon.toml`);
      return { project: loadProject(root), only: null };
    }
    const project = projectOfFile(a.files[0]);
    if (!project) return null;
    const only = new Set(a.files.map((f) => resolve(f)));
    for (const f of only) {
      if (!project.modules.some((m) => m.abs === f)) {
        throw new UsageError(`${relative(process.cwd(), f)} is not a module of the project at ${relative(process.cwd(), project.root) || "."}`);
      }
    }
    return { project, only };
  } catch (e) {
    if (e instanceof ProjectError) throw new UsageError(e.message);
    throw e;
  }
}

function checkScope(scope: Scope, a: Args, sources?: Map<string, string>): ProjectResult {
  return checkProject(scope.project.modules.map((m) => ({ ...m, src: sources?.get(m.abs) ?? m.src })), opts(a));
}

function inScope(scope: Scope, path: string): boolean {
  return scope.only === null || scope.only.has(resolve(path));
}

function cmdCheck(a: Args, io: CliIO): Outcome {
  if (a.fix) return cmdFix(a, io);
  const scope = projectScope(a);
  const results = scope
    ? [
      ...checkScope(scope, a).modules.filter((m) => inScope(scope, m.path)).sort((x, y) => x.path.localeCompare(y.path))
        .map((m) => ({ path: m.path, result: m.result })),
      ...(scope.only === null ? driftResults(scope.project) : []),
    ]
    : a.files.map((f) => ({ path: f, result: check(readFile(f), f, opts(a)) }));
  if (a.json) {
    const out = results.length === 1 ? results[0].result : results.map((r) => ({ path: r.path, ...r.result }));
    io.stdout(JSON.stringify(out, null, 2) + "\n");
  } else {
    for (const r of results) report(r.path, r.result, io);
  }
  const n = results.reduce((s, r) => s + r.result.diagnostics.length, 0);
  return { code: results.every((r) => r.result.ok) ? 0 : 1, summary: problems(n) };
}

/** v0.5: G001 for every hand-edited file in the project's output folders, as check results. */
function driftResults(project: Project): { path: string; result: CheckResult }[] {
  const dirs = [project.config.backend?.out, project.config.frontend?.out].filter((d): d is string => !!d);
  const found: { path: string; text: string }[] = [];
  for (const d of dirs) {
    const abs = resolve(project.root, d);
    if (!existsSync(abs)) continue;
    for (const f of listFiles(abs)) found.push({ path: relative(project.root, f).split(sep).join("/"), text: readFileSync(f, "utf8") });
  }
  return driftDiagnostics(found).map((g) => ({
    path: relative(process.cwd(), join(project.root, g.path)) || g.path,
    result: { ok: false, canonical: true, diagnostics: [g.diagnostic] },
  }));
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "__pycache__") return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

/** `check --fix`: the self-healing loop. Only diagnostics that need judgment are reported. */
function cmdFix(a: Args, io: CliIO): Outcome {
  const scope = projectScope(a);
  if (scope) return cmdFixProject(a, io, scope);
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

/** `check --fix` across a project: apply mechanical patches module by module to a fixed point. */
function cmdFixProject(a: Args, io: CliIO, scope: Scope): Outcome {
  const sources = new Map(scope.project.modules.map((m) => [m.abs, m.src]));
  const applied = new Map<string, string[]>(scope.project.modules.map((m) => [m.abs, []]));
  const allowed = new Set(MECHANICAL_CODES);
  let result = checkScope(scope, a, sources);
  for (let round = 0; round < 64; round++) {
    let changed = false;
    for (const m of result.modules) {
      const abs = resolve(m.path);
      if (!inScope(scope, m.path)) continue;
      const d = m.result.diagnostics.find((x) => allowed.has(x.code) && x.fix !== undefined);
      if (!d) continue;
      const next = applyPatch(sources.get(abs)!, d.fix!.diff);
      if (next === null || next === sources.get(abs)) continue;
      sources.set(abs, next);
      applied.get(abs)!.push(d.code);
      changed = true;
      break;
    }
    if (!changed) break;
    result = checkScope(scope, a, sources);
  }
  const rows = result.modules.filter((m) => inScope(scope, m.path)).sort((x, y) => x.path.localeCompare(y.path)).map((m) => {
    const abs = resolve(m.path);
    const original = scope.project.modules.find((x) => x.abs === abs)!.src;
    if (a.write && sources.get(abs) !== original) writeOwn(m.path, sources.get(abs)!);
    return { path: m.path, result: m.result, applied: applied.get(abs)!, source: sources.get(abs)! };
  });
  if (a.json) {
    const shape = (r: (typeof rows)[number]) => ({ ...r.result, applied: r.applied, source: r.source });
    io.stdout(JSON.stringify(rows.length === 1 ? shape(rows[0]) : rows.map((r) => ({ path: r.path, ...shape(r) })), null, 2) + "\n");
  } else {
    for (const r of rows) {
      if (r.applied.length) io.stdout(`${r.path}: applied ${r.applied.join(", ")}${a.write ? "" : " (not written; add --write)"}\n`);
      report(r.path, r.result, io);
    }
  }
  const n = rows.reduce((s, r) => s + r.result.diagnostics.length, 0);
  return { code: result.ok ? 0 : 1, summary: problems(n) };
}

/**
 * A checked project compiled to one JavaScript program (top-level names are unique across a
 * project, so the modules link by concatenation). Null after reporting diagnostics.
 */
function compileProject(a: Args, scope: Scope, io: CliIO): string | null {
  const r = checkScope(scope, a);
  if (!r.ok) {
    const bad = r.modules.filter((m) => !m.result.ok);
    if (a.json) io.stdout(JSON.stringify({ ok: false, files: bad.map((m) => ({ path: m.path, ...m.result })) }, null, 2) + "\n");
    else for (const m of bad) report(m.path, m.result, io, "stderr");
    return null;
  }
  const text = withFeatures(a.features, () => programText(linkProject(r)));
  const c = compileJs(text, scope.project.config.project.name, opts(a));
  if (!c.js) throw new Error(`internal error: the linked project does not compile: ${JSON.stringify(c.check.diagnostics.slice(0, 3))}`);
  return c.js;
}

/** v0.5: `canon manifest`, the endpoints of a project or file. */
function cmdManifest(a: Args, io: CliIO): Outcome {
  const scope = projectScope(a);
  let mods: { module: string | null; prog: Program }[];
  if (scope) {
    const r = checkScope(scope, a);
    if (!r.ok) {
      compileProject(a, scope, io); // reports the diagnostics
      return { code: 1, summary: "does not check" };
    }
    mods = r.modules.map((m) => ({ module: m.name, prog: m.analysis.prog! }));
  } else {
    if (a.files.length !== 1) throw new UsageError("canon manifest takes one file, or none in a project");
    const path = a.files[0];
    const an = analyze(readFile(path), path, opts(a));
    if (!an.result.ok || !an.prog) {
      if (a.json) io.stdout(JSON.stringify({ ok: false, diagnostics: an.result.diagnostics }, null, 2) + "\n");
      else report(path, an.result, io, "stderr");
      return { code: 1, summary: "does not check" };
    }
    mods = [{ module: null, prog: an.prog }];
  }
  const m = manifest(mods);
  if (a.json) io.stdout(JSON.stringify({ ok: true, ...m }, null, 2) + "\n");
  else io.stdout(manifestText(m));
  return { code: 0, summary: `${m.endpoints.length} endpoints` };
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
  const scope = projectScope(a);
  const units = scope ? [{ path: scope.project.config.project.name, js: () => compileProject(a, scope, io) }]
    : a.files.map((path) => ({ path, js: () => compileFor(a, path, io) }));
  for (const { path, js: compile } of units) {
    const js = compile();
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

// ---------------------------------------------------------------------------------- project build (v0.5)

/** Check a whole project with paths relative to its root (generated headers name them). */
function checkForBuild(project: Project, a: Args): ProjectResult {
  return checkProject(project.modules.map((m) => ({ name: m.name, src: readSource(readFileSync(m.abs, "utf8")),
    path: relative(project.root, m.abs).split(sep).join("/") })), opts(a));
}

interface BuildReport {
  ok: boolean;
  written: string[];
  unchanged: string[];
  removed: string[];
  refused: { path: string; diagnostic: Diagnostic }[];
  diagnostics: { path: string; diagnostics: Diagnostic[] }[];
}

/** Generate both sides into the folders canon.toml names. Nothing is written unless all of it can be. */
function buildProject(project: Project, a: Args): BuildReport {
  const report: BuildReport = { ok: false, written: [], unchanged: [], removed: [], refused: [], diagnostics: [] };
  const fresh = loadProject(project.root);
  const r = checkForBuild(fresh, a);
  if (!r.ok) {
    report.diagnostics = r.modules.filter((m) => !m.result.ok).map((m) => ({ path: m.path, diagnostics: m.result.diagnostics }));
    return report;
  }
  let outputs;
  try {
    outputs = buildOutputs(r, fresh.config, a.target ?? undefined, { py: a.features.py === true });
  } catch (e) {
    if (!(e instanceof TargetError)) throw e;
    report.diagnostics = e.diagnostics.map((d) => ({ path: d.path, diagnostics: [d.diagnostic] }));
    return report;
  }
  if (!outputs.length) throw new UsageError("canon.toml names no [backend] or [frontend] to build");
  const abs = (p: string) => join(fresh.root, p);
  const wanted = new Set(outputs.map((o) => o.path));
  // files on disk: hand edits are refused, and generated files nobody produces any more are removed
  const stale: string[] = [];
  const dirs = [...new Set(outputs.map((o) => o.dir))];
  for (const d of dirs) {
    if (!existsSync(abs(d))) continue;
    const found = listFiles(abs(d)).map((f) => ({ path: relative(fresh.root, f).split(sep).join("/"), text: readFileSync(f, "utf8") }));
    const drift = driftDiagnostics(found);
    report.refused.push(...drift);
    for (const f of found) {
      if (!wanted.has(f.path) && /^(#|\/\/) Generated by Canon /.test(f.text) && !drift.some((x) => x.path === f.path)) stale.push(f.path);
    }
  }
  for (const o of outputs) {
    if (o.userOwned || !existsSync(abs(o.path))) continue;
    const text = readFileSync(abs(o.path), "utf8");
    if (!/^(#|\/\/) Generated by Canon /.test(text)) {
      report.refused.push({ path: o.path, diagnostic: { code: "G001", severity: "error", line: 1, col: 1,
        message: `${o.path} exists and was not generated by Canon; move it, or run canon build --force to replace it` } });
    }
  }
  if (report.refused.length && !a.force) return report;
  for (const o of outputs) {
    const p = abs(o.path);
    if (existsSync(p)) {
      if (o.userOwned || readFileSync(p, "utf8") === o.text) {
        report.unchanged.push(o.path);
        continue;
      }
    }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, o.text);
    report.written.push(o.path);
  }
  for (const s of stale) {
    rmSync(abs(s));
    report.removed.push(s);
  }
  report.ok = true;
  if (a.force) report.refused = [];
  return report;
}

function printBuild(report: BuildReport, a: Args, io: CliIO): Outcome {
  if (a.json) {
    io.stdout(JSON.stringify(report, null, 2) + "\n");
  } else {
    for (const f of report.diagnostics) for (const d of f.diagnostics) io.stderr(formatDiagnostic(f.path, d));
    for (const f of report.refused) io.stderr(formatDiagnostic(f.path, f.diagnostic));
    if (report.ok) {
      const parts = [`wrote ${report.written.length} file${report.written.length === 1 ? "" : "s"}`];
      if (report.unchanged.length) parts.push(`${report.unchanged.length} unchanged`);
      if (report.removed.length) parts.push(`removed ${report.removed.join(", ")}`);
      io.stdout(`canon build: ${parts.join(", ")}\n`);
    } else if (report.refused.length) {
      io.stderr("canon build: nothing written; generated files were edited by hand (see above)\n");
    }
  }
  return { code: report.ok ? 0 : 1, summary: report.ok ? `built (${report.written.length} written)` : "build failed" };
}

function cmdBuildProject(a: Args, io: CliIO, project: Project): Outcome {
  if (a.out || a.module) throw new UsageError("-o and --module build one file to JavaScript; a project builds from canon.toml");
  return printBuild(buildProject(project, a), a, io);
}

function cmdBuild(a: Args, io: CliIO): Outcome {
  if (a.files.length === 0) {
    const root = findProjectRoot(process.cwd());
    if (!root) throw new UsageError("canon build needs a file, or a project: run it in a folder with canon.toml");
    return cmdBuildProject(a, io, loadProjectOrUsage(root));
  }
  if (a.target || a.force) throw new UsageError("--target and --force are for a project build (canon build with no file)");
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
 * v0.5: rerun on every save of a .cn file under the project's source folder (debounced), until
 * SIGINT. Used by canon build --watch and canon dev.
 */
function watchProject(project: Project, io: CliIO, rerun: () => void, onStop: () => void = () => {}): Promise<number> {
  return new Promise((done) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (_ev?: string, name?: string | Buffer | null) => {
      if (name && !name.toString().endsWith(".cn")) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        rerun();
      }, 150);
    };
    const watcher: FSWatcher = fsWatch(project.srcDir, { recursive: true }, schedule);
    rerun();
    const stop = () => {
      watcher.close();
      if (timer) clearTimeout(timer);
      onStop();
      done(130);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    void io;
  });
}

/** v0.5: canon dev, canon build --watch plus the backend served by uvicorn --reload. */
async function cmdDev(a: Args, io: CliIO): Promise<number> {
  const root = findProjectRoot(process.cwd());
  if (!root) throw new UsageError("canon dev runs in a project: a folder with canon.toml");
  const project = loadProjectOrUsage(root);
  if (!project.config.backend) throw new UsageError("canon dev serves the backend: canon.toml needs a [backend] section");
  const backendDir = dirname(resolve(root, project.config.backend.out));
  const status = (s: string) => io.stdout(`[${clock()}] canon dev: ${s}\n`);
  let server: ChildProcess | null = null;
  const startServer = () => {
    if (server) return;
    const python = process.env.CANON_PYTHON || "python3";
    server = spawn(python, ["-m", "uvicorn", "main:app", "--reload", "--port", String(a.port)], { cwd: backendDir, stdio: ["ignore", "inherit", "inherit"] });
    server.on("exit", (code) => {
      server = null;
      if (code !== null && code !== 0) status(`uvicorn exited with ${code} (is it installed for ${python}? set CANON_PYTHON)`);
    });
    status(`serving ${relative(process.cwd(), backendDir) || "."} at http://127.0.0.1:${a.port}`);
  };
  return watchProject(project, io, () => {
    const outcome = printBuild(buildProject(project, a), a, io);
    status(outcome.summary);
    if (outcome.code === 0) startServer();
  }, () => {
    if (server) server.kill("SIGTERM");
  });
}

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
        case "manifest":
          return cmdManifest(a, io);
        default:
          return cmdTest(a, io);
      }
    };
    if (a.cmd === "fmt") return cmdFmt(a, io);
    if (a.cmd === "dev") return await cmdDev(a, io);
    if (a.watch && a.cmd === "build" && a.files.length === 0) {
      const root = findProjectRoot(process.cwd());
      if (!root) throw new UsageError("canon build --watch needs a file, or a project: run it in a folder with canon.toml");
      const project = loadProjectOrUsage(root);
      return await watchProject(project, io, () => {
        const outcome = printBuild(buildProject(project, a), a, io);
        io.stdout(`[${clock()}] build: ${outcome.summary}\n`);
      });
    }
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
