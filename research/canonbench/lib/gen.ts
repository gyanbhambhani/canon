/**
 * Typed random inputs for a seed, in the JSON test encoding. Half are mutations of the hidden
 * tests' inputs (so they stay near the interesting part of the input space), half are fresh draws
 * from the signature's types, using the characters and integers that appear in the tests.
 */
import { parse, type TypeExpr } from "@canon/compiler";
import type { Case } from "./seed.js";
import { typeOf, type SigLike } from "./types.js";

export type Rnd = () => number;
export function mulberry32(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Decls {
  records: Map<string, [string, TypeExpr][]>;
  sums: Map<string, [string, [string, TypeExpr][]][]>;
}

function declsOf(s: SigLike): Decls {
  const d: Decls = { records: new Map(), sums: new Map() };
  if (!s.decls?.canon) return d;
  for (const it of parse(s.decls.canon).items) {
    if (it.k === "RecordType") d.records.set(it.name, it.fields);
    else if (it.k === "SumType") d.sums.set(it.name, it.variants);
  }
  return d;
}

function leaves(v: unknown, strs: Set<string>, ints: Set<number>) {
  if (typeof v === "string") {
    for (const c of v) strs.add(c);
    strs.add("\u0000" + v); // whole strings, marked
  } else if (typeof v === "number" && Number.isInteger(v)) ints.add(v);
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, strs, ints));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => leaves(x, strs, ints));
}

export class InputGen {
  private chars: string[];
  private words: string[];
  private ints: number[];
  private d: Decls;
  private params: TypeExpr[];
  constructor(private sig: SigLike, private cases: Case[], private r: Rnd) {
    const strs = new Set<string>();
    const ints = new Set<number>([0, 1, -1, 2]);
    cases.forEach((c) => leaves(c.args, strs, ints));
    this.chars = [...strs].filter((s) => !s.startsWith("\u0000"));
    if (!this.chars.length) this.chars = ["a", "b", " "];
    this.words = [...strs].filter((s) => s.startsWith("\u0000")).map((s) => s.slice(1));
    this.ints = [...ints];
    this.d = declsOf(sig);
    this.params = sig.params.map(([, t]) => typeOf(t));
  }
  private pick<T>(xs: T[]): T {
    return xs[Math.floor(this.r() * xs.length)];
  }
  private int(): number {
    const x = this.r();
    if (x < 0.6) return this.pick(this.ints);
    if (x < 0.8) return this.pick(this.ints) + (this.r() < 0.5 ? 1 : -1);
    return Math.floor(this.r() * 41) - 10;
  }
  private str(): string {
    if (this.words.length && this.r() < 0.3) return this.mutStr(this.pick(this.words));
    const n = Math.floor(this.r() * 9);
    let s = "";
    for (let i = 0; i < n; i++) s += this.pick(this.chars);
    return s;
  }
  private mutStr(s: string): string {
    const cs = [...s];
    const i = Math.floor(this.r() * (cs.length + 1));
    const op = this.r();
    if (op < 0.33 && cs.length) cs.splice(Math.min(i, cs.length - 1), 1);
    else if (op < 0.66) cs.splice(i, 0, this.pick(this.chars));
    else if (cs.length) cs[Math.min(i, cs.length - 1)] = this.pick(this.chars);
    return cs.join("");
  }
  gen(t: TypeExpr, depth = 0): unknown {
    if (t.k === "TTuple") return t.items.map((x) => this.gen(x, depth + 1));
    if (t.k !== "TName") throw new Error("unfuzzable type");
    switch (t.name) {
      case "Int":
        return this.int();
      case "Float":
        return Math.round((this.r() * 40 - 10) * 4) / 4;
      case "String":
        return this.str();
      case "Bool":
        return this.r() < 0.5;
      case "List": {
        const n = depth > 2 ? Math.floor(this.r() * 3) : Math.floor(this.r() * 7);
        return Array.from({ length: n }, () => this.gen(t.args[0], depth + 1));
      }
      case "Option":
        return this.r() < 0.25 ? null : this.gen(t.args[0], depth + 1);
      case "Result":
        return this.r() < 0.5 ? { ok: true, value: this.gen(t.args[0], depth + 1) } : { ok: false, error: this.str() };
    }
    const rec = this.d.records.get(t.name);
    if (rec) return Object.fromEntries(rec.map(([n, ft]) => [n, this.gen(ft, depth + 1)]));
    const sum = this.d.sums.get(t.name);
    if (sum) {
      const [vn, fields] = this.pick(sum);
      return { kind: vn, ...Object.fromEntries(fields.map(([n, ft]) => [n, this.gen(ft, depth + 1)])) };
    }
    throw new Error(`unknown type ${t.name}`);
  }
  mutate(v: unknown, t: TypeExpr, depth = 0): unknown {
    if (this.r() < 0.15) return this.gen(t, depth);
    if (t.k === "TTuple") {
      const arr = [...(v as unknown[])];
      const i = Math.floor(this.r() * arr.length);
      arr[i] = this.mutate(arr[i], t.items[i], depth + 1);
      return arr;
    }
    if (t.k !== "TName") return v;
    switch (t.name) {
      case "Int":
        return (v as number) + this.pick([-1, 1, -2, 2, 10]);
      case "String":
        return this.mutStr(v as string);
      case "Bool":
        return !v;
      case "Float":
        return (v as number) + this.pick([-0.5, 0.5, 1]);
      case "Option":
        return v === null ? this.gen(t.args[0], depth + 1) : this.r() < 0.2 ? null : this.mutate(v, t.args[0], depth + 1);
      case "List": {
        const arr = [...(v as unknown[])];
        const op = this.r();
        if (op < 0.25 && arr.length) arr.splice(Math.floor(this.r() * arr.length), 1);
        else if (op < 0.5) arr.splice(Math.floor(this.r() * (arr.length + 1)), 0, arr.length && this.r() < 0.5 ? this.pick(arr) : this.gen(t.args[0], depth + 1));
        else if (op < 0.65 && arr.length > 1) {
          const i = Math.floor(this.r() * arr.length);
          const j = Math.floor(this.r() * arr.length);
          [arr[i], arr[j]] = [arr[j], arr[i]];
        } else if (arr.length) {
          const i = Math.floor(this.r() * arr.length);
          arr[i] = this.mutate(arr[i], t.args[0], depth + 1);
        } else arr.push(this.gen(t.args[0], depth + 1));
        return arr;
      }
    }
    const rec = this.d.records.get(t.name);
    if (rec && v && typeof v === "object") {
      const [n, ft] = this.pick(rec);
      return { ...(v as object), [n]: this.mutate((v as Record<string, unknown>)[n], ft, depth + 1) };
    }
    const sum = this.d.sums.get(t.name);
    if (sum && v && typeof v === "object") {
      const kind = (v as { kind: string }).kind;
      const fields = sum.find(([vn]) => vn === kind)?.[1] ?? [];
      if (!fields.length || this.r() < 0.3) return this.gen(t, depth);
      const [n, ft] = this.pick(fields);
      return { ...(v as object), [n]: this.mutate((v as Record<string, unknown>)[n], ft, depth + 1) };
    }
    return v;
  }
  /** One argument list: a mutated test input, or a fresh draw. */
  next(): unknown[] {
    if (this.cases.length && this.r() < 0.5) {
      const base = this.pick(this.cases).args;
      const i = Math.floor(this.r() * base.length);
      return base.map((a, j) => (j === i ? this.mutate(a, this.params[j]) : a));
    }
    return this.params.map((t) => this.gen(t));
  }
}
