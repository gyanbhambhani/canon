/**
 * Effect runners for Canon (compiled by @canon/compiler, run on @canon/runtime with a recording
 * Host) and TypeScript (transpiled to CommonJS, run in a node:vm context whose `require` serves a
 * mocked "node:fs" and "./http", with recording Date.now / new Date() / Math.random / Atomics.wait
 * / console). Nothing touches the real disk, network, clock or random source.
 *
 * CLI: npx tsx --conditions=source sandbox/effects/js_runner.ts canon|ts effects/<id>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { compileJs } from "@canon/compiler";
import { Runtime, type Host } from "@canon/runtime";
import { decodeArg, ERROR, World, type HostSpec, type Kind } from "./mock.js";

export interface Drive {
  fn: string;
  args: unknown[];
}
export interface CallRecord {
  fn: string;
  /** the normalized return value; ERROR for a Canon Err or a thrown exception */
  v: unknown;
  effects: Kind[];
  /** an error's message (Err or exception), for reports */
  err?: string;
  /** a crash that is not a modelled failure: a Canon trap, a TypeError, a missing function... */
  crash?: string;
  requests: string[];
  /** files changed by the call: path -> new content */
  writes: Record<string, string>;
}

const isMap = (x: unknown): x is Map<unknown, unknown> => Object.prototype.toString.call(x) === "[object Map]";

type TypeTable = Record<string, { fields?: unknown; variants?: unknown }>;

function fromCanon(v: unknown, types: TypeTable): unknown {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map((x) => fromCanon(x, types));
  if (isMap(v)) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), fromCanon(x, types)]));
  if (typeof v !== "object") return v;
  const { $t, ...rest } = v as Record<string, unknown>;
  const fields = Object.fromEntries(Object.entries(rest).map(([k, x]) => [k, fromCanon(x, types)]));
  if ($t === "Some" || $t === "Ok") return fields.value;
  if ($t === "None") return null;
  if ($t === "Err") return ERROR;
  if (typeof $t === "string" && types[$t]?.fields) return fields;
  return $t === undefined ? fields : { kind: $t, ...fields };
}

function fromJs(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(fromJs);
  if (isMap(v)) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), fromJs(x)]));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, fromJs(x)]));
  return v;
}

const errMessage = (e: unknown) => String((e as { message?: string })?.message ?? e).slice(0, 300);

export function loadSeed(dir: string): { host: HostSpec; drive: Drive[] } {
  const truth = JSON.parse(readFileSync(join(dir, "truth.json"), "utf8"));
  const host = JSON.parse(readFileSync(join(dir, "host.json"), "utf8"));
  return { host, drive: truth.drive };
}

// ---------------------------------------------------------------- Canon

export function runCanon(source: string, host: HostSpec, drive: Drive[]): CallRecord[] {
  const world = new World(host);
  const h: Host = {
    print: (s) => world.print(s),
    readLine: () => null,
    readFile: (p) => world.readFile(p),
    writeFile: (p, t) => (world.writeFile(p, t), { ok: true, value: "" }),
    httpGet: (u) => world.http("GET", u),
    httpPost: (u, b) => world.http("POST", u, b),
    now: () => world.now(),
    sleep: (ms) => world.sleep(ms),
    random: () => world.random(),
    denied: new Set(),
  };
  const c = compileJs(source, "program.cn");
  if (!c.js) return drive.map((d) => ({ fn: d.fn, v: null, effects: [], crash: "Canon program does not check", requests: [], writes: {} }));
  const rt = new Runtime(h);
  const mod = new Function("$rt", c.js)(rt) as { fns: Record<string, (...a: unknown[]) => unknown>; types: TypeTable };
  return drive.map((d) => {
    world.reset();
    rt.stack.length = 0;
    const rec: CallRecord = { fn: d.fn, v: null, effects: [], requests: [], writes: {} };
    const f = mod.fns[d.fn];
    if (!f) rec.crash = `no function ${d.fn}`;
    else {
      try {
        const raw = f(...d.args.map(decodeArg));
        rec.v = fromCanon(raw, mod.types);
        if (raw && typeof raw === "object" && (raw as { $t?: string }).$t === "Err") rec.err = JSON.stringify((raw as { error: unknown }).error);
      } catch (e) {
        rec.crash = `${(e as { code?: string }).code ?? "throw"}: ${errMessage(e)}`;
      }
    }
    rec.effects = world.effects();
    rec.requests = world.log;
    rec.writes = world.writes();
    return rec;
  });
}

// ---------------------------------------------------------------- TypeScript

/** Runs inside the vm context: mocks built from the recording world, with errors made in-realm. */
const PRELUDE = `
const __RealDate = Date;
globalThis.Date = class Date extends __RealDate {
  constructor(...a) { if (a.length === 0) super(__w.now()); else super(...a); }
  static now() { return __w.now(); }
};
Math.random = () => __w.random();
Atomics.wait = (_a, _i, _v, ms) => { __w.sleep(ms); return "timed-out"; };
globalThis.console = { log: (...a) => __w.print(a.join(" ")), error: (...a) => __w.print(a.join(" ")), warn: (...a) => __w.print(a.join(" ")) };
const __fail = (msg, code) => { const e = new Error(msg); if (code) e.code = code; return e; };
const __fs = {
  readFileSync(path, _enc) {
    const r = __w.readFile(String(path));
    if (!r.ok) throw __fail("ENOENT: " + r.error, "ENOENT");
    return r.value;
  },
  writeFileSync(path, text) { __w.writeFile(String(path), String(text)); },
  appendFileSync(path, text) {
    const r = __w.readFile(String(path));
    __w.writeFile(String(path), (r.ok ? r.value : "") + String(text));
  },
  existsSync(path) { return __w.readFile(String(path)).ok; },
};
const __http = {
  httpGet(url) {
    const r = __w.http("GET", String(url));
    if (!r.ok) throw __fail("http: " + r.error);
    return r.value;
  },
  httpPost(url, body) {
    const r = __w.http("POST", String(url), String(body));
    if (!r.ok) throw __fail("http: " + r.error);
    return r.value;
  },
};
globalThis.require = (name) => {
  if (name === "node:fs" || name === "fs") return __fs;
  if (name === "./http") return __http;
  throw __fail("module not available in the sandbox: " + name);
};
`;

const CRASH_NAMES = new Set(["TypeError", "ReferenceError", "RangeError", "SyntaxError"]);

export function runTs(source: string, host: HostSpec, drive: Drive[]): CallRecord[] {
  const world = new World(host);
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ctx = vm.createContext({ __w: world, __js: js, __args: [] as unknown[] });
  vm.runInContext(PRELUDE, ctx);
  vm.runInContext(`globalThis.__mod = { exports: {} }; (new Function("exports", "module", "require", __js))(__mod.exports, __mod, require);`, ctx);
  const exportsObj = (ctx as { __mod: { exports: Record<string, unknown> } }).__mod.exports;
  return drive.map((d) => {
    world.reset();
    const rec: CallRecord = { fn: d.fn, v: null, effects: [], requests: [], writes: {} };
    if (typeof exportsObj[d.fn] !== "function") rec.crash = `no exported function ${d.fn}`;
    else {
      ctx.__args = d.args.map(decodeArg);
      ctx.__name = d.fn;
      try {
        rec.v = fromJs(vm.runInContext(`__mod.exports[__name](...__args)`, ctx, { timeout: 5000 }));
      } catch (e) {
        const name = (e as { name?: string })?.name ?? "";
        if (CRASH_NAMES.has(name)) rec.crash = `${name}: ${errMessage(e)}`;
        else {
          rec.v = ERROR;
          rec.err = errMessage(e);
        }
      }
    }
    rec.effects = world.effects();
    rec.requests = world.log;
    rec.writes = world.writes();
    return rec;
  });
}

if (process.argv[1]?.endsWith("js_runner.ts")) {
  const [lang, dir] = process.argv.slice(2);
  const { host, drive } = loadSeed(dir);
  const src = readFileSync(join(dir, lang === "canon" ? "program.cn" : "program.ts"), "utf8");
  const out = lang === "canon" ? runCanon(src, host, drive) : runTs(src, host, drive);
  console.log(JSON.stringify(out, null, 1));
}
