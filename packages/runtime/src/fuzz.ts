/**
 * v0.3 contract fuzzing (`canon test`, off with `--no-contract-fuzz`). Every pure, non-generic
 * function that declares `requires` or `ensures` is called on inputs generated from its parameter
 * types. Inputs that fail the function's own `requires` are discarded; any other trap (an
 * `ensures` that fails, an `assert`, overflow, division by zero) is a counterexample. Inputs come
 * from a seeded generator, so a run is reproducible.
 */
import { load, Runtime, type RunOptions } from "./exec.js";
import { seeded, type Host } from "./host.js";
import { Trap, type TrapJson } from "./trap.js";
import { NONE, show, type TD, type TypeTable } from "./values.js";

export interface FuzzOutcome {
  /** "fuzz NAME" */
  name: string;
  fn: string;
  passed: boolean;
  /** inputs that satisfied requires and were run */
  runs: number;
  /** inputs discarded because they failed requires */
  discarded: number;
  /** set when no input could be generated (a function-typed parameter, say) */
  skipped?: string;
  counterexample?: { args: string[]; trap: TrapJson };
}

export interface FuzzOptions extends RunOptions {
  /** inputs tried per function (default 200) */
  tries?: number;
  seed?: number;
}

class Unfuzzable extends Error {}

const ALPHABET = ["a", "b", "z", " ", ",", "-", "1", "0", "9", "A", "é"];

function gen(td: TD, rnd: () => number, table: TypeTable, depth: number): unknown {
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  if (typeof td === "string") {
    switch (td) {
      case "Int": {
        const r = rnd();
        if (r < 0.3) return [0, 1, -1, 2, 10, -10, 100][int(0, 6)];
        if (r < 0.9) return int(-50, 50);
        return int(-100000, 100000);
      }
      case "Float": {
        const r = rnd();
        if (r < 0.3) return [0, 0.5, -0.5, 1, -1, 2.5][int(0, 5)];
        return Math.round((rnd() * 200 - 100) * 100) / 100;
      }
      case "Bool":
        return rnd() < 0.5;
      case "String": {
        const n = int(0, 6);
        let s = "";
        for (let i = 0; i < n; i++) s += ALPHABET[int(0, ALPHABET.length - 1)];
        return s;
      }
      case "Unit":
        return undefined;
      default:
        throw new Unfuzzable(`a parameter of unknown type`);
    }
  }
  if ("L" in td) {
    const n = depth > 3 ? 0 : int(0, 5);
    return Array.from({ length: n }, () => gen(td.L, rnd, table, depth + 1));
  }
  if ("M" in td) {
    const n = depth > 3 ? 0 : int(0, 4);
    const m = new Map();
    for (let i = 0; i < n; i++) m.set(gen(td.M[0], rnd, table, depth + 1), gen(td.M[1], rnd, table, depth + 1));
    return m;
  }
  if ("T" in td) return td.T.map((t) => gen(t, rnd, table, depth + 1));
  if ("F" in td) throw new Unfuzzable("a function-typed parameter");
  if ("P" in td) throw new Unfuzzable("a generic parameter");
  const decl = table[td.C];
  if (!decl) throw new Unfuzzable(`type ${td.C}`);
  const sub = (t: TD): TD => substitute(t, td.a);
  if (decl.fields) {
    const rec: Record<string, unknown> = { $t: td.C };
    for (const [n, ft] of decl.fields) rec[n] = gen(sub(ft), rnd, table, depth + 1);
    return rec;
  }
  const variants = Object.entries(decl.variants ?? {});
  if (variants.length === 0) throw new Unfuzzable(`type ${td.C}`);
  // deep in a recursive type, prefer the variant with the fewest fields so values stay finite
  const pick = depth > 3 ? [...variants].sort((a, b) => a[1].length - b[1].length)[0] : variants[int(0, variants.length - 1)];
  const [vn, fields] = pick;
  if (vn === "None" && fields.length === 0) return NONE;
  const v: Record<string, unknown> = { $t: vn };
  for (const [n, ft] of fields) v[n] = gen(sub(ft), rnd, table, depth + 1);
  return v;
}

function substitute(td: TD, args: TD[]): TD {
  if (typeof td === "string") return td;
  if ("P" in td) return args[td.P] ?? "?";
  if ("L" in td) return { L: substitute(td.L, args) };
  if ("M" in td) return { M: [substitute(td.M[0], args), substitute(td.M[1], args)] };
  if ("T" in td) return { T: td.T.map((t) => substitute(t, args)) };
  if ("C" in td) return { C: td.C, a: td.a.map((t) => substitute(t, args)) };
  return td;
}

/** Fuzz every contract-bearing pure function in a compiled program. */
export function fuzzContracts(js: string, host: Host, opts: FuzzOptions = {}): FuzzOutcome[] {
  const rt = new Runtime(host, opts);
  const mod = load(js, rt);
  // pure functions perform no effects; the guard makes that a hard guarantee while fuzzing
  rt.allowed = new Set();
  rt.allowedBy = "a pure function";
  const tries = opts.tries ?? 200;
  const out: FuzzOutcome[] = [];
  for (const entry of mod.fuzz ?? []) {
    const f = mod.fns[entry.name];
    const res: FuzzOutcome = { name: `fuzz ${entry.name}`, fn: entry.name, passed: true, runs: 0, discarded: 0 };
    if (entry.skip) {
      res.skipped = entry.skip;
      out.push(res);
      continue;
    }
    const rnd = seeded(opts.seed ?? 2026);
    for (let i = 0; i < tries; i++) {
      let args: unknown[];
      try {
        args = entry.params.map(([, td]) => gen(td, rnd, mod.types, 0));
      } catch (e) {
        if (!(e instanceof Unfuzzable)) throw e;
        res.skipped = e.message;
        break;
      }
      try {
        f(...args);
        res.runs++;
      } catch (e) {
        rt.stack.length = 0;
        if (e instanceof Trap && e.code === "R001" && e.stack_.length === 1 && e.stack_[0].fn === entry.name) {
          res.discarded++;
          continue;
        }
        if (!(e instanceof Trap) && !(e instanceof RangeError)) throw e;
        const trap: TrapJson = e instanceof Trap
          ? e.toJSON()
          : { code: "R000", message: "stack overflow (recursion too deep)", line: 0, col: 0, stack: [] };
        res.passed = false;
        res.runs++;
        res.counterexample = {
          args: entry.params.map(([n, td], j) => `${n} = ${show(args[j], td, mod.types, false)}`),
          trap,
        };
        break;
      }
    }
    // no input got past requires: nothing was checked, so it is a skip, not a pass
    if (!res.skipped && res.passed && res.runs === 0) res.skipped = `all ${res.discarded} generated inputs failed requires`;
    out.push(res);
  }
  return out;
}
