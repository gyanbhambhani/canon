/**
 * The object generated code receives as `$rt`: arithmetic with traps, the standard library,
 * contracts, the Canon-level call stack, and the effect host.
 */
import { type Effect, type Host } from "./host.js";
import { Early, type Frame, Trap, type TrapJson } from "./trap.js";
import {
  cmpKey, cmpStr, eq, err, errorRecord, NONE, ok, show, some, type Tagged, type TD, type TypeTable,
} from "./values.js";

type List = unknown[];
type Fn = (...args: any[]) => unknown;

export interface RunOptions {
  /** requires/ensures are checked unless this is false (canon run --no-contracts). */
  contracts?: boolean;
}

export class Runtime {
  readonly stack: Frame[] = [];
  contracts: boolean;
  types: TypeTable = {};
  readonly Early = Early;
  readonly eq = eq;

  constructor(readonly host: Host, opts: RunOptions = {}) {
    this.contracts = opts.contracts !== false;
  }

  // -- stack and traps
  enter(fn: string, line: number, col: number) {
    this.stack.push({ fn, line, col });
  }
  leave() {
    this.stack.pop();
  }
  /** Record the current position in the innermost frame (before a user call). */
  at(line: number, col: number) {
    const top = this.stack[this.stack.length - 1];
    if (top) {
      top.line = line;
      top.col = col;
    }
  }
  trap(code: string, message: string, line: number, col: number): never {
    this.at(line, col);
    const frames = [...this.stack].reverse().map((f) => ({ ...f }));
    throw new Trap(code, message, line, col, frames);
  }

  // -- Int arithmetic (R003 overflow, R004 division by zero)
  ck(n: number, line: number, col: number): number {
    if (!Number.isSafeInteger(n)) this.trap("R003", "integer overflow: the result is outside the 53-bit safe range", line, col);
    return n;
  }
  idiv(a: number, b: number, line: number, col: number): number {
    if (b === 0) this.trap("R004", "division by zero", line, col);
    return this.ck(Math.trunc(a / b), line, col);
  }
  imod(a: number, b: number, line: number, col: number): number {
    if (b === 0) this.trap("R004", "modulo by zero", line, col);
    return a % b;
  }
  fdiv(a: number, b: number, line: number, col: number): number {
    if (b === 0) this.trap("R004", "division by zero", line, col);
    return a / b;
  }
  fmod(a: number, b: number, line: number, col: number): number {
    if (b === 0) this.trap("R004", "modulo by zero", line, col);
    return a % b;
  }
  /** <, <=, >, >= on strings compare by code point. */
  scmp(a: string, b: string): number {
    return cmpStr(a, b);
  }

  /** `try e`: unwrap Ok, or return the Err from the enclosing function. */
  tryv(r: Tagged): unknown {
    if (r.$t === "Err") throw new Early(r);
    return r.value;
  }

  private effect(e: Effect, fn: string, line: number, col: number) {
    if (this.host.denied.has(e)) {
      const note = this.host.denyNote ? `; ${this.host.denyNote}` : "";
      this.trap("R006", `effect ${e} denied by the host (${fn})${note}`, line, col);
    }
  }

  // -- the standard library: every function takes (line, col, ...args)
  readonly std: Record<string, Fn> = {
    len: (_l: number, _c: number, xs: List) => xs.length,
    map: (_l: number, _c: number, xs: List, f: Fn) => xs.map((x) => f(x)),
    filter: (_l: number, _c: number, xs: List, f: Fn) => xs.filter((x) => f(x)),
    fold: (_l: number, _c: number, xs: List, init: unknown, f: Fn) => {
      let acc = init;
      for (const x of xs) acc = f(acc, x);
      return acc;
    },
    sum: (l: number, c: number, xs: number[]) => {
      let t = 0;
      for (const x of xs) t = this.ck(t + x, l, c);
      return t;
    },
    sum_float: (_l: number, _c: number, xs: number[]) => {
      let t = 0;
      for (const x of xs) t += x;
      return t;
    },
    sort_by: (_l: number, _c: number, xs: List, key: Fn) => {
      const keyed = xs.map((x) => [key(x), x] as const);
      return keyed.sort((a, b) => cmpKey(a[0], b[0])).map((p) => p[1]);
    },
    sort_desc_by: (_l: number, _c: number, xs: List, key: Fn) => {
      const keyed = xs.map((x) => [key(x), x] as const);
      return keyed.sort((a, b) => cmpKey(b[0], a[0])).map((p) => p[1]);
    },
    group_by: (_l: number, _c: number, xs: List, key: Fn) => {
      const groups = new Map<unknown, unknown[]>();
      for (const x of xs) {
        const k = key(x);
        const g = groups.get(k);
        if (g) g.push(x);
        else groups.set(k, [x]);
      }
      return [...groups].map(([k, g]) => [k, g]);
    },
    take: (_l: number, _c: number, xs: List, n: number) => xs.slice(0, Math.max(0, n)),
    drop: (_l: number, _c: number, xs: List, n: number) => xs.slice(Math.max(0, n)),
    first: (_l: number, _c: number, xs: List) => (xs.length ? some(xs[0]) : NONE),
    last: (_l: number, _c: number, xs: List) => (xs.length ? some(xs[xs.length - 1]) : NONE),
    append: (_l: number, _c: number, xs: List, x: unknown) => [...xs, x],
    contains: (_l: number, _c: number, xs: List, x: unknown) => xs.some((y) => eq(x, y)),
    reverse: (_l: number, _c: number, xs: List) => [...xs].reverse(),
    zip: (_l: number, _c: number, xs: List, ys: List) => {
      const n = Math.min(xs.length, ys.length);
      const out: unknown[] = [];
      for (let i = 0; i < n; i++) out.push([xs[i], ys[i]]);
      return out;
    },
    enumerate: (_l: number, _c: number, xs: List) => xs.map((x, i) => [i, x]),
    range: (_l: number, _c: number, start: number, end: number) => {
      const out: number[] = [];
      for (let i = start; i < end; i++) out.push(i);
      return out;
    },
    min: (_l: number, _c: number, a: number, b: number) => Math.min(a, b),
    max: (_l: number, _c: number, a: number, b: number) => Math.max(a, b),
    abs: (l: number, c: number, n: number) => this.ck(Math.abs(n), l, c),
    pow: (l: number, c: number, base: number, exp: number) => {
      if (exp < 0) {
        // integer power truncates toward zero, like Int division
        if (base === 0) this.trap("R004", "division by zero (0 to a negative power)", l, c);
        if (base === 1) return 1;
        if (base === -1) return exp % 2 === 0 ? 1 : -1;
        return 0;
      }
      let r = 1;
      for (let i = 0; i < exp; i++) {
        r = this.ck(r * base, l, c);
        if (r === 0 || r === 1) break;
      }
      return r;
    },
    to_string: (_l: number, _c: number, x: unknown, td: TD = "?") => show(x, td, this.types),
    to_float: (_l: number, _c: number, n: number) => n,
    to_int: (l: number, c: number, x: number) => {
      if (!Number.isFinite(x)) this.trap("R003", `to_int of ${x} is not a finite number`, l, c);
      return this.ck(Math.trunc(x) || 0, l, c);
    },
    parse_int: (_l: number, _c: number, s: string) => {
      if (!/^[+-]?\d+$/.test(s)) return NONE;
      const n = Number(s);
      return Number.isSafeInteger(n) ? some(n) : NONE;
    },
    parse_float: (_l: number, _c: number, s: string) => {
      if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return NONE;
      const n = Number(s);
      return Number.isFinite(n) ? some(n) : NONE;
    },
    concat: (_l: number, _c: number, ...parts: string[]) => parts.join(""),
    join: (_l: number, _c: number, parts: string[], sep: string) => parts.join(sep),
    split: (_l: number, _c: number, s: string, sep: string) => (sep === "" ? Array.from(s) : s.split(sep)),
    trim: (_l: number, _c: number, s: string) => s.trim(),
    str_len: (_l: number, _c: number, s: string) => {
      let n = 0;
      for (const _ of s) n++;
      return n;
    },
    unwrap_or: (_l: number, _c: number, o: Tagged, fallback: unknown) => (o.$t === "Some" ? o.value : fallback),
    map_from: (_l: number, _c: number, pairs: [unknown, unknown][]) => new Map(pairs),
    map_get: (_l: number, _c: number, m: Map<unknown, unknown>, k: unknown) => (m.has(k) ? some(m.get(k)) : NONE),
    map_set: (_l: number, _c: number, m: Map<unknown, unknown>, k: unknown, v: unknown) => new Map(m).set(k, v),
    keys: (_l: number, _c: number, m: Map<unknown, unknown>) => [...m.keys()],
    values: (_l: number, _c: number, m: Map<unknown, unknown>) => [...m.values()],
    assert: (l: number, c: number, cond: boolean) => {
      if (!cond) this.trap("R005", "assert failed", l, c);
    },
    // effectful
    print: (l: number, c: number, s: string) => {
      this.effect("io", "print", l, c);
      this.host.print(s);
    },
    read_line: (l: number, c: number) => {
      this.effect("io", "read_line", l, c);
      const s = this.host.readLine();
      return s === null ? NONE : some(s);
    },
    read_file: (l: number, c: number, path: string) => {
      this.effect("fs", "read_file", l, c);
      return this.result(this.host.readFile(path), (v) => v);
    },
    write_file: (l: number, c: number, path: string, text: string) => {
      this.effect("fs", "write_file", l, c);
      return this.result(this.host.writeFile(path, text), () => undefined);
    },
    http_get: (l: number, c: number, url: string) => {
      this.effect("net", "http_get", l, c);
      return this.result(this.host.httpGet(url), (v) => v);
    },
    http_post: (l: number, c: number, url: string, body: string) => {
      this.effect("net", "http_post", l, c);
      return this.result(this.host.httpPost(url, body), (v) => v);
    },
    now: (l: number, c: number) => {
      this.effect("time", "now", l, c);
      return Math.floor(this.host.now());
    },
    sleep: (l: number, c: number, ms: number) => {
      this.effect("time", "sleep", l, c);
      this.host.sleep(ms);
    },
    random: (l: number, c: number) => {
      this.effect("rand", "random", l, c);
      return this.host.random();
    },
    random_int: (l: number, c: number, lo: number, hi: number) => {
      this.effect("rand", "random_int", l, c);
      if (hi <= lo) this.trap("R005", `random_int needs lo < hi, got ${lo} and ${hi}`, l, c);
      return lo + Math.floor(this.host.random() * (hi - lo));
    },
  };

  private result(r: { ok: true; value: string } | { ok: false; error: string }, f: (v: string) => unknown) {
    return r.ok ? ok(f(r.value)) : err(errorRecord(r.error));
  }
}

export interface CanonModule {
  /** Every user function, by Canon name (for embedding and test harnesses). */
  fns: Record<string, (...args: any[]) => unknown>;
  main?: () => unknown;
  tests: [string, () => void][];
  types: TypeTable;
  /** Descriptor of main's return type, used to print an Err. */
  mainRet?: TD;
}

/** Instantiate compiled JavaScript (from @canon/compiler's compileJs) against a runtime. */
export function load(js: string, rt: Runtime): CanonModule {
  const mod = new Function("$rt", js)(rt) as CanonModule;
  rt.types = mod.types;
  return mod;
}

export interface MainResult {
  status: 0 | 1;
  trap?: TrapJson;
  /** Set when main returned Err: the error's message. */
  error?: string;
}

function asTrap(e: unknown, rt: Runtime): TrapJson {
  if (e instanceof Trap) return e.toJSON();
  if (e instanceof RangeError && /call stack/i.test(e.message)) {
    const top = rt.stack[rt.stack.length - 1];
    return { code: "R000", message: "stack overflow (recursion too deep)", line: top?.line ?? 0, col: top?.col ?? 0, stack: [] };
  }
  throw e;
}

export function runMain(js: string, host: Host, opts: RunOptions = {}): MainResult {
  const rt = new Runtime(host, opts);
  const mod = load(js, rt);
  if (!mod.main) {
    return { status: 1, error: "no fn main() -> Unit in this file" };
  }
  try {
    const r = mod.main() as Tagged | undefined;
    if (r && typeof r === "object" && r.$t === "Err") {
      const e = r.error as Tagged;
      const message = e && typeof e === "object" && e.$t === "Error" ? (e.message as string) : show(e, "?", rt.types);
      return { status: 1, error: message };
    }
    return { status: 0 };
  } catch (e) {
    return { status: 1, trap: asTrap(e, rt) };
  }
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  trap?: TrapJson;
}

export function runTests(js: string, host: Host, opts: RunOptions = {}): TestOutcome[] {
  const out: TestOutcome[] = [];
  const rt = new Runtime(host, opts);
  const mod = load(js, rt);
  for (const [name, fn] of mod.tests) {
    try {
      fn();
      out.push({ name, passed: true });
    } catch (e) {
      rt.stack.length = 0;
      out.push({ name, passed: false, trap: asTrap(e, rt) });
    }
  }
  return out;
}
