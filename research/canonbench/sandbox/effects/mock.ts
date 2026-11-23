/**
 * The mocked, recording world shared by the Canon and TypeScript effect runners. The Python
 * harness (py_effects_harness.py) implements the same world; both must stay in step.
 *
 * World, reset before every drive call:
 *   files   an in-memory map, copied from the seed's host.json "files"
 *   http    host.json "http": url -> list of responses; the n-th request to a url gets entry
 *           min(n, len - 1); an entry {"error": msg} fails; an unknown url fails
 *   clock   now() returns T0, T0 + 1000, T0 + 2000, ... (one step per read); sleep records the
 *           effect and does not move the clock (so Python's float seconds stay exact)
 *   random  mulberry32 seeded with 42; random_int(lo, hi) = lo + floor(r * (hi - lo))
 * Every access records its effect kind: fs, net, time, rand, io.
 */
export type Kind = "fs" | "net" | "time" | "rand" | "io";
export type HttpEntry = string | { error: string };
export interface HostSpec {
  files?: Record<string, string>;
  http?: Record<string, HttpEntry[]>;
}

export const T0 = 1_700_000_000_000;
export const SEED = 42;

/** mulberry32, identical to @canon/runtime's `seeded`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  files = new Map<string, string>();
  hits = new Map<string, number>();
  clock = 0;
  rand: () => number = mulberry32(SEED);
  seen = new Set<Kind>();
  /** requests made, for debugging: "GET url" / "POST url body" */
  log: string[] = [];

  constructor(readonly spec: HostSpec) {
    this.reset();
  }

  reset() {
    this.files = new Map(Object.entries(this.spec.files ?? {}));
    this.hits = new Map();
    this.clock = 0;
    this.rand = mulberry32(SEED);
    this.seen = new Set();
    this.log = [];
  }

  readFile(path: string): { ok: true; value: string } | { ok: false; error: string } {
    this.seen.add("fs");
    const t = this.files.get(path);
    return t === undefined ? { ok: false, error: `no such file: ${path}` } : { ok: true, value: t };
  }
  writeFile(path: string, text: string) {
    this.seen.add("fs");
    this.files.set(path, text);
  }
  http(method: string, url: string, body?: string): { ok: true; value: string } | { ok: false; error: string } {
    this.seen.add("net");
    this.log.push(`${method} ${url}${body === undefined ? "" : ` ${body}`}`);
    const entries = this.spec.http?.[url];
    if (!entries || entries.length === 0) return { ok: false, error: `connection refused: ${url}` };
    const n = this.hits.get(url) ?? 0;
    this.hits.set(url, n + 1);
    const e = entries[Math.min(n, entries.length - 1)];
    return typeof e === "string" ? { ok: true, value: e } : { ok: false, error: e.error };
  }
  now(): number {
    this.seen.add("time");
    return T0 + 1000 * this.clock++;
  }
  sleep(_ms: number) {
    this.seen.add("time");
  }
  random(): number {
    this.seen.add("rand");
    return this.rand();
  }
  print(_s: string) {
    this.seen.add("io");
  }
  /** files whose content differs from the seed's initial files, after a call */
  writes(): Record<string, string> {
    const init = this.spec.files ?? {};
    return Object.fromEntries([...this.files.entries()].filter(([p, t]) => init[p] !== t).sort(([a], [b]) => (a < b ? -1 : 1)));
  }
  effects(): Kind[] {
    return [...this.seen].sort();
  }
}

/** Drive arguments: JSON, where {"$map": [[k, v], ...]} is a map (Canon Map, TS Map, Python dict). */
export function decodeArg(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decodeArg);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("$map" in o) return new Map((o.$map as [unknown, unknown][]).map(([k, x]) => [k, decodeArg(x)]));
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, decodeArg(x)]));
  }
  return v;
}

/** The marker every language's failure (Canon Err, Python exception, TypeScript throw) becomes. */
export const ERROR = { $error: true };
