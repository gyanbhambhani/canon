/**
 * Verify the READ-family effect seeds in effects/<id>/ (program.cn, program.py, program.ts,
 * truth.json, host.json). For every seed:
 *   (a) canon check reports zero diagnostics; mypy --strict passes; tsc --strict passes (with
 *       declarations for "node:fs" and "./http", see TS_DECLS)
 *       and the three programs define exactly the functions truth.json lists
 *   (b) every effect recorded during a drive call to f is in truth[f] (callees included)
 *   (c) every effect in truth[f] is recorded in at least one drive call to f, in every language
 *       (and every function is driven at least once, so pure decoys are confirmed pure)
 *   (d) Canon's declared `effects:` of every fn equal truth[f]
 *   (e) every drive call returns the same value, makes the same HTTP requests and leaves the same
 *       file writes in all three languages; no call crashes (a trap, TypeError, ...)
 * Prints a per-seed PASS/FAIL table; exits 1 on any failure.
 *
 * Usage: npx tsx --conditions=source scripts/verify-effects.ts [-v] [seed...]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { check, parse } from "@canon/compiler";
import { approxEqual, VENV } from "../adapters/exec.js";
import { checkCode } from "../arms/check.js";
import { BENCH } from "../lib/seed.js";
import { runCanon, runTs, type CallRecord, type Drive } from "../sandbox/effects/js_runner.js";
import type { HostSpec } from "../sandbox/effects/mock.js";

const EFFECTS = join(BENCH, "effects");
const PY_HARNESS = join(BENCH, "sandbox", "effects", "py_effects_harness.py");
type L = "canon" | "py" | "ts";
const LANGS: L[] = ["canon", "py", "ts"];

// ---------------------------------------------------------------- TypeScript type check

const TS_DECLS: Record<string, string> = {
  "/seed/http.ts": "export declare function httpGet(url: string): string;\nexport declare function httpPost(url: string, body: string): string;\n",
  "/seed/node-fs.d.ts": `declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string): void;
  export function appendFileSync(path: string, data: string): void;
  export function existsSync(path: string): boolean;
}
`,
};

function tsCheck(code: string): string[] {
  const files: Record<string, string> = { ...TS_DECLS, "/seed/program.ts": code };
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"],
    types: [],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, v) => (f in files ? ts.createSourceFile(f, files[f], v) : getSourceFile(f, v));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (f) => f in files || fileExists(f);
  const readFile = host.readFile.bind(host);
  host.readFile = (f) => (f in files ? files[f] : readFile(f));
  const directoryExists = host.directoryExists?.bind(host);
  host.directoryExists = (d) => d === "/seed" || (directoryExists ? directoryExists(d) : false);
  const realpath = host.realpath?.bind(host);
  host.realpath = (p) => (p in files ? p : realpath ? realpath(p) : p);
  const program = ts.createProgram(["/seed/program.ts", "/seed/node-fs.d.ts"], options, host);
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return `TS${d.code} ${d.file?.fileName ?? ""}:${pos ? pos.line + 1 : 0}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
}

// ---------------------------------------------------------------- run

function runPy(path: string, host: HostSpec, drive: Drive[]): CallRecord[] {
  const r = spawnSync(join(VENV, "python"), ["-I", PY_HARNESS], { input: JSON.stringify({ path, host, drive }), encoding: "utf8", timeout: 60_000, cwd: "/tmp" });
  try {
    return JSON.parse((r.stdout ?? "").trim().split("\n").pop() ?? "");
  } catch {
    const msg = `python harness failed: ${(r.stderr || String(r.error ?? "")).slice(-400)}`;
    return drive.map((d) => ({ fn: d.fn, v: null, effects: [], crash: msg, requests: [], writes: {} }));
  }
}

const pyFns = (src: string) => [...src.matchAll(/^def ([a-z_][a-z0-9_]*)\(/gm)].map((m) => m[1]);
const tsFns = (src: string) => [...src.matchAll(/^export function ([a-z_][a-z0-9_]*)\(/gm)].map((m) => m[1]);
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

interface SeedReport {
  id: string;
  checks: Record<string, boolean>;
  problems: string[];
  calls: number;
}

/** Self-test mutations: edit the truth or a program in memory, to show the checks can fail. */
interface Mutation {
  truth?: (t: { functions: Record<string, string[]>; drive: Drive[] }) => void;
  src?: (s: Record<L, string>) => void;
}

function verify(id: string, verbose: boolean, mut: Mutation = {}): SeedReport {
  const dir = join(EFFECTS, id);
  const src: Record<L, string> = { canon: readFileSync(join(dir, "program.cn"), "utf8"), py: readFileSync(join(dir, "program.py"), "utf8"), ts: readFileSync(join(dir, "program.ts"), "utf8") };
  const truth = JSON.parse(readFileSync(join(dir, "truth.json"), "utf8")) as { functions: Record<string, string[]>; drive: Drive[] };
  mut.truth?.(truth);
  const pyOriginal = src.py;
  mut.src?.(src);
  let pyPath = join(dir, "program.py");
  if (src.py !== pyOriginal) {
    const tmp = mkdtempSync(join(tmpdir(), "cb-eff-"));
    pyPath = join(tmp, "program.py");
    writeFileSync(pyPath, src.py);
  }
  const host = JSON.parse(readFileSync(join(dir, "host.json"), "utf8")) as HostSpec;
  const problems: string[] = [];
  const checks: Record<string, boolean> = { a: true, b: true, c: true, d: true, e: true };
  const fail = (k: string, msg: string) => {
    checks[k] = false;
    problems.push(`(${k}) ${msg}`);
  };
  const names = Object.keys(truth.functions);

  // (a) checkers and function sets
  const cd = check(src.canon, "program.cn").diagnostics;
  for (const d of cd) fail("a", `canon ${d.code} ${d.line}:${d.col} ${d.message}`);
  const py = checkCode("py", src.py);
  if (!py.ok) fail("a", `mypy --strict: ${py.feedback.slice(0, 600)}`);
  for (const d of tsCheck(src.ts)) fail("a", `tsc: ${d}`);
  let canonFns: { name: string; effects: string[] }[] = [];
  try {
    canonFns = parse(src.canon).items.filter((it) => it.k === "Fn") as { name: string; effects: string[] }[];
  } catch (e) {
    fail("a", `canon parse: ${(e as Error).message}`);
  }
  if (!sameSet(canonFns.map((f) => f.name), names)) fail("a", `canon functions ${canonFns.map((f) => f.name)} != truth ${names}`);
  if (!sameSet(pyFns(src.py), names)) fail("a", `python functions ${pyFns(src.py)} != truth ${names}`);
  if (!sameSet(tsFns(src.ts), names)) fail("a", `typescript functions ${tsFns(src.ts)} != truth ${names}`);

  // (d) Canon's declared effects
  for (const f of canonFns) {
    const want = [...(truth.functions[f.name] ?? [])].sort();
    const got = [...f.effects].sort();
    if (want.join(",") !== got.join(",")) fail("d", `canon ${f.name} declares [${got}] but truth is [${want}]`);
  }

  // run
  const runs: Record<L, CallRecord[]> = {
    canon: runCanon(src.canon, host, truth.drive),
    py: runPy(pyPath, host, truth.drive),
    ts: runTs(src.ts, host, truth.drive),
  };

  // (b), (c)
  for (const n of names) if (!truth.drive.some((d) => d.fn === n)) fail("c", `${n} is never driven`);
  for (const l of LANGS) {
    const seen = new Map<string, Set<string>>();
    runs[l].forEach((r, i) => {
      const d = truth.drive[i];
      if (r.crash) fail("e", `${l} call #${i} ${d.fn}(${JSON.stringify(d.args)}) crashed: ${r.crash}`);
      const allowed = truth.functions[d.fn] ?? [];
      for (const e of r.effects) {
        if (!allowed.includes(e)) fail("b", `${l} call #${i} ${d.fn} performed ${e}, truth is [${allowed}]`);
      }
      const s = seen.get(d.fn) ?? new Set();
      r.effects.forEach((e) => s.add(e));
      seen.set(d.fn, s);
    });
    for (const n of names) {
      for (const e of truth.functions[n]) if (!seen.get(n)?.has(e)) fail("c", `${l}: ${e} of ${n} never observed`);
    }
  }

  // (e) agreement
  truth.drive.forEach((d, i) => {
    const [c, p, t] = LANGS.map((l) => runs[l][i]);
    for (const [l, r] of [["py", p], ["ts", t]] as const) {
      if (!approxEqual(r.v, c.v)) fail("e", `call #${i} ${d.fn}: ${l} returned ${JSON.stringify(r.v)}, canon ${JSON.stringify(c.v)}`);
      if (JSON.stringify(r.requests) !== JSON.stringify(c.requests)) fail("e", `call #${i} ${d.fn}: ${l} requests ${JSON.stringify(r.requests)}, canon ${JSON.stringify(c.requests)}`);
      if (JSON.stringify(r.writes) !== JSON.stringify(c.writes)) fail("e", `call #${i} ${d.fn}: ${l} writes ${JSON.stringify(r.writes)}, canon ${JSON.stringify(c.writes)}`);
    }
    if (verbose) console.log(`  ${id} #${i} ${d.fn}(${JSON.stringify(d.args)}) -> ${JSON.stringify(c.v)} [${c.effects}]${c.err ? ` err=${c.err}` : ""}`);
  });
  return { id, checks, problems, calls: truth.drive.length };
}

const argv = process.argv.slice(2);
const verbose = argv.includes("-v");
const wanted = argv.filter((a) => a !== "-v");
const ids = readdirSync(EFFECTS)
  .filter((d) => existsSync(join(EFFECTS, d, "truth.json")))
  .filter((d) => wanted.length === 0 || wanted.includes(d))
  .sort();

if (argv.includes("--selftest")) {
  // Each mutation of config_cache must be caught by the named check.
  const cases: [string, string, Mutation][] = [
    ["truth drops time from needs_reload", "b", { truth: (t) => void (t.functions.needs_reload = []) }],
    ["truth adds net to get_setting", "c", { truth: (t) => void (t.functions.get_setting = ["fs", "net"]) }],
    ["truth adds net to get_setting (Canon declares fs)", "d", { truth: (t) => void (t.functions.get_setting = ["fs", "net"]) }],
    ["python pure decoy reads the clock", "b", { src: (s) => void (s.py = s.py.replace("    return now_ms - loaded_at < ttl_ms", "    time.time()\n    return now_ms - loaded_at < ttl_ms")) }],
    ["typescript pure helper draws a random number", "b", { src: (s) => void (s.ts = s.ts.replace("  const parts = line.split(\"=\");", "  Math.random();\n  const parts = line.split(\"=\");")) }],
    ["typescript type error", "a", { src: (s) => void (s.ts = s.ts.replace("return now_ms - loaded_at < ttl_ms;", "return now_ms - loaded_at < ttl_ms ? 1 : 0;")) }],
    ["python returns a different value", "e", { src: (s) => void (s.py = s.py.replace("return fallback if value is None else value", "return fallback if value is None else value.upper()")) }],
    ["drive never calls reload_if_stale on a stale cache", "c", { truth: (t) => void (t.drive = t.drive.filter((d) => !(d.fn === "reload_if_stale" && d.args[2] === 1600000000000))) }],
  ];
  let bad = 0;
  for (const [what, check, m] of cases) {
    const r = verify("config_cache", false, m);
    const caught = !r.checks[check];
    if (!caught) bad++;
    console.log(`${caught ? "caught " : "MISSED "} (${check}) ${what}`);
  }
  console.log(bad ? `\n${bad} mutation(s) missed` : `\nall ${cases.length} mutations caught`);
  process.exit(bad ? 1 : 0);
}

const reports = ids.map((id) => verify(id, verbose));
const mark = (b: boolean) => (b ? "ok " : "FAIL");
console.log(`\n${"seed".padEnd(22)} calls  a    b    c    d    e    result`);
for (const r of reports) {
  const pass = Object.values(r.checks).every(Boolean);
  console.log(`${r.id.padEnd(22)} ${String(r.calls).padStart(5)}  ${["a", "b", "c", "d", "e"].map((k) => mark(r.checks[k])).join(" ")} ${pass ? "PASS" : "FAIL"}`);
}
const failed = reports.filter((r) => !Object.values(r.checks).every(Boolean));
for (const r of failed) {
  console.log(`\n${r.id}:`);
  for (const p of r.problems.slice(0, 25)) console.log(`  ${p}`);
}
console.log(`\n${reports.length - failed.length}/${reports.length} seeds pass (a: checkers, b: no undeclared effect, c: every effect observed, d: Canon effects = truth, e: languages agree)`);
process.exit(failed.length ? 1 : 0);
