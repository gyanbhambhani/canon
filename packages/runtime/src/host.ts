/** Effect hosts. Effectful built-ins go through a host, so the CLI, browser and tests supply their own. */
export type Effect = "fs" | "io" | "net" | "rand" | "time";

export type HostResult = { ok: true; value: string } | { ok: false; error: string };

export interface Host {
  /** Write one line (without its newline) to standard output. */
  print(s: string): void;
  readLine(): string | null;
  readFile(path: string): HostResult;
  writeFile(path: string, text: string): HostResult;
  httpGet(url: string): HostResult;
  httpPost(url: string, body: string): HostResult;
  now(): number;
  sleep(ms: number): void;
  random(): number;
  /** Effects whose calls trap with R006. */
  denied: Set<Effect>;
  /** Why an effect is denied, appended to the R006 message (e.g. "the browser playground denies fs"). */
  denyNote?: string;
}

const unavailable = (what: string): HostResult => ({ ok: false, error: `${what} is not available in this host` });

/** mulberry32: a small seeded PRNG for reproducible tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A host that keeps output in memory: base for the browser and for tests. */
export class MemoryHost implements Host {
  out: string[] = [];
  denied = new Set<Effect>();
  denyNote?: string;
  constructor(private readonly onPrint?: (s: string) => void, private readonly input: string[] = []) {}
  print(s: string) {
    this.out.push(s);
    this.onPrint?.(s);
  }
  readLine() {
    return this.input.length ? this.input.shift()! : null;
  }
  /** An in-memory file system (tests); denied in the browser playground. */
  files = new Map<string, string>();
  readFile(path: string): HostResult {
    const text = this.files.get(path);
    return text === undefined ? { ok: false, error: `no such file: ${path}` } : { ok: true, value: text };
  }
  writeFile(path: string, text: string): HostResult {
    this.files.set(path, text);
    return { ok: true, value: "" };
  }
  httpGet(url: string) {
    return unavailable(`http_get(${JSON.stringify(url)})`);
  }
  httpPost(url: string) {
    return unavailable(`http_post(${JSON.stringify(url)})`);
  }
  now() {
    return Date.now();
  }
  sleep(ms: number) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // busy-wait: Canon is synchronous and workers may not have Atomics.wait
    }
  }
  random() {
    return Math.random();
  }
}

/** The browser playground: io, time and rand are allowed; fs and net are denied. */
export function browserHost(onPrint: (s: string) => void): MemoryHost {
  const h = new MemoryHost(onPrint);
  h.denied = new Set(["fs", "net"]);
  h.denyNote = "the browser playground denies fs and net";
  return h;
}

/**
 * The test host: time starts at 0 ms and advances only through sleep, and rand is seeded
 * with 42, so every run is reproducible. Other effects go to the wrapped host.
 */
export function testHost(base: Host): Host {
  let clock = 0;
  const rand = seeded(42);
  return {
    print: (s) => base.print(s),
    readLine: () => base.readLine(),
    readFile: (p) => base.readFile(p),
    writeFile: (p, t) => base.writeFile(p, t),
    httpGet: (u) => base.httpGet(u),
    httpPost: (u, b) => base.httpPost(u, b),
    now: () => clock,
    sleep: (ms) => {
      clock += Math.max(0, ms);
    },
    random: () => rand(),
    denied: base.denied,
    denyNote: base.denyNote,
  };
}
