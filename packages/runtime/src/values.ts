/** Value helpers: structural equality, ordering and to_string. */

export type Tagged = { $t: string; [k: string]: unknown };

export const some = (value: unknown): Tagged => ({ $t: "Some", ["value"]: value });
export const NONE: Tagged = Object.freeze({ $t: "None" }) as Tagged;
export const ok = (value: unknown): Tagged => ({ $t: "Ok", ["value"]: value });
export const err = (error: unknown): Tagged => ({ $t: "Err", ["error"]: error });
export const errorRecord = (message: string): Tagged => ({ $t: "Error", ["message"]: message });

export function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
    return true;
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !eq(v, b.get(k))) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!eq((a as any)[k], (b as any)[k])) return false;
  return true;
}

/** Compare two strings by code point. */
export function cmpStr(a: string, b: string): number {
  if (a === b) return 0;
  const x = a[Symbol.iterator]();
  const y = b[Symbol.iterator]();
  for (;;) {
    const p = x.next();
    const q = y.next();
    if (p.done) return q.done ? 0 : -1;
    if (q.done) return 1;
    const d = p.value.codePointAt(0)! - q.value.codePointAt(0)!;
    if (d !== 0) return d;
  }
}

/** Order two keys (Int, Float or String). */
export function cmpKey(a: unknown, b: unknown): number {
  if (typeof a === "string" && typeof b === "string") return cmpStr(a, b);
  return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
}

/** Python-style repr of a float: 1.0, 0.1, 1e+16. */
export function floatText(v: number): string {
  if (Number.isNaN(v)) return "nan";
  if (!Number.isFinite(v)) return v > 0 ? "inf" : "-inf";
  if (v === 0) return Object.is(v, -0) ? "-0.0" : "0.0";
  const neg = v < 0;
  const [mant, expS] = Math.abs(v).toExponential().split("e");
  const digits = mant.replace(".", "");
  const decpt = Number(expS) + 1;
  let s: string;
  if (decpt <= -4 || decpt > 16) {
    const e = decpt - 1;
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    s = `${m}e${e < 0 ? "-" : "+"}${Math.abs(e).toString().padStart(2, "0")}`;
  } else if (decpt <= 0) s = "0." + "0".repeat(-decpt) + digits;
  else if (decpt >= digits.length) s = digits + "0".repeat(decpt - digits.length) + ".0";
  else s = digits.slice(0, decpt) + "." + digits.slice(decpt);
  return neg ? "-" + s : s;
}

/**
 * Type descriptors, emitted by the code generator so to_string can tell Int 1 from Float 1.0.
 *   "Int" | "Float" | "String" | "Bool" | "Unit" | "?" (unknown: decided from the value)
 *   { L: td } list · { M: [k, v] } map · { T: [..] } tuple · { F: 1 } function
 *   { C: name, a: [..] } named type · { P: i } i-th type parameter of the enclosing named type
 */
export type TD = string | { L: TD } | { M: [TD, TD] } | { T: TD[] } | { F: 1 } | { C: string; a: TD[] } | { P: number };

/** Declarations of named types: field descriptors per record or per variant. */
export type TypeTable = Record<string, { params: number; fields?: [string, TD][]; variants?: Record<string, [string, TD][]> }>;

function subst(td: TD, args: TD[]): TD {
  if (typeof td === "string") return td;
  if ("P" in td) return args[td.P] ?? "?";
  if ("L" in td) return { L: subst(td.L, args) };
  if ("M" in td) return { M: [subst(td.M[0], args), subst(td.M[1], args)] };
  if ("T" in td) return { T: td.T.map((t) => subst(t, args)) };
  if ("C" in td) return { C: td.C, a: td.a.map((t) => subst(t, args)) };
  return td;
}

function quote(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
}

/**
 * v0.4: a Canon-Py program shows values in its own spelling: `True`/`False`, `None` for Unit, and
 * records as `Item(sku="a", qty=1)`. Set by load() from the compiled module.
 */
let pyStyle = false;
export function setPyStyle(on: boolean): void {
  pyStyle = on;
}

const boolText = (b: unknown) => (pyStyle ? (b ? "True" : "False") : b ? "true" : "false");
const unitText = () => (pyStyle ? "None" : "()");
const recordText = (name: string, parts: [string, string][]) =>
  pyStyle
    ? `${name}(${parts.map(([n, v]) => `${n}=${v}`).join(", ")})`
    : parts.length ? `${name} { ${parts.map(([n, v]) => `${n}: ${v}`).join(", ")} }` : `${name} {}`;

export function show(x: unknown, td: TD, table: TypeTable, top = true): string {
  if (typeof td === "string") {
    switch (td) {
      case "Int":
        return String(x);
      case "Float":
        return floatText(x as number);
      case "String":
        return top ? (x as string) : quote(x as string);
      case "Bool":
        return boolText(x);
      case "Unit":
        return unitText();
    }
    return showDynamic(x, table, top);
  }
  if ("L" in td) return `[${(x as unknown[]).map((v) => show(v, td.L, table, false)).join(", ")}]`;
  if ("T" in td) return `(${(x as unknown[]).map((v, i) => show(v, td.T[i] ?? "?", table, false)).join(", ")})`;
  if ("M" in td) {
    return `{${[...(x as Map<unknown, unknown>)].map(([k, v]) => `${show(k, td.M[0], table, false)}: ${show(v, td.M[1], table, false)}`).join(", ")}}`;
  }
  if ("F" in td) return "<fn>";
  if ("C" in td) {
    const decl = table[td.C];
    const o = x as Tagged;
    if (decl?.fields) {
      return recordText(td.C, decl.fields.map(([n, ft]) => [n, show(o[n], subst(ft, td.a), table, false)]));
    }
    const fields = decl?.variants?.[o.$t];
    if (fields) {
      return fields.length ? `${o.$t}(${fields.map(([n, ft]) => show(o[n], subst(ft, td.a), table, false)).join(", ")})` : o.$t;
    }
  }
  return showDynamic(x, table, top);
}

/** Formatting without static types (inside generic code): integers print without ".0". */
function showDynamic(x: unknown, table: TypeTable, top: boolean): string {
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : floatText(x);
  if (typeof x === "string") return top ? x : quote(x);
  if (typeof x === "boolean") return boolText(x);
  if (x === undefined || x === null) return unitText();
  if (typeof x === "function") return "<fn>";
  if (Array.isArray(x)) return `[${x.map((v) => showDynamic(v, table, false)).join(", ")}]`;
  if (x instanceof Map) return `{${[...x].map(([k, v]) => `${showDynamic(k, table, false)}: ${showDynamic(v, table, false)}`).join(", ")}}`;
  const o = x as Tagged;
  const keys = Object.keys(o).filter((k) => k !== "$t");
  if (table[o.$t]?.fields) {
    return recordText(o.$t, keys.map((k) => [k, showDynamic(o[k], table, false)]));
  }
  return keys.length ? `${o.$t}(${keys.map((k) => showDynamic(o[k], table, false)).join(", ")})` : o.$t;
}
