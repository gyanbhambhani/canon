/** TypeScript reference solutions (full modules: the task's decls, then the exported function). Each passes tsc --strict and every test. */

const P1_TS: Record<string, string> = {
  caesar_shift: `export function caesar_shift(s: string, k: number): string {
  let out = "";
  for (const c of s) {
    if (c >= "a" && c <= "z") {
      const i = (((c.charCodeAt(0) - 97 + k) % 26) + 26) % 26;
      out += String.fromCharCode(97 + i);
    } else {
      out += c;
    }
  }
  return out;
}
`,
  wrap_text: `export function wrap_text(s: string, width: number): string[] {
  const words = s.split(" ").filter((w) => w !== "");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
`,
  align_columns: `export function align_columns(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const r of rows) r.forEach((c, j) => (widths[j] = Math.max(widths[j] ?? 0, c.length)));
  return rows.map((r) => r.map((c, j) => c.padEnd(widths[j])).join(" | ").replace(/ +$/, ""));
}
`,
  rle_compress: `export function rle_compress(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += s[i] + (j - i >= 2 ? String(j - i) : "");
    i = j;
  }
  return out.length < s.length ? out : s;
}
`,
  rle_decode: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function rle_decode(s: string): Result<string> {
  if (/^[0-9]/.test(s)) return { ok: false, error: "missing character before count" };
  let out = "";
  const re = /([^0-9])([0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[2] === "") out += m[1];
    else if (m[2][0] === "0") return { ok: false, error: "bad count for " + m[1] };
    else out += m[1].repeat(Number(m[2]));
  }
  return { ok: true, value: out };
}
`,
  pig_latin: `function word(w: string): string {
  let n = -1;
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const vowel = ("aeiou".includes(c) && !(c === "u" && i > 0 && w[i - 1] === "q")) || (c === "y" && i > 0);
    if (vowel) {
      n = i;
      break;
    }
  }
  if (n === 0) return w + "way";
  if (n < 0) return w + "ay";
  return w.slice(n) + w.slice(0, n) + "ay";
}

export function pig_latin(s: string): string {
  if (s === "") return "";
  return s.split(" ").map(word).join(" ");
}
`,
  roman_to_int: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const VALS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const TABLE: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let out = "";
  for (const [v, sym] of TABLE) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

export function roman_to_int(s: string): Result<number> {
  if (s === "") return { ok: false, error: "empty" };
  for (const c of s) if (!(c in VALS)) return { ok: false, error: "invalid character: " + c };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALS[s[i]];
    const next = i + 1 < s.length ? VALS[s[i + 1]] : 0;
    total += v < next ? -v : v;
  }
  if (total < 1 || total > 3999 || toRoman(total) !== s) return { ok: false, error: "not canonical" };
  return { ok: true, value: total };
}
`,
  anagram_groups: `export function anagram_groups(words: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const w of words) {
    const k = [...w].sort().join("");
    const g = groups.get(k);
    if (g) g.push(w);
    else groups.set(k, [w]);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}
`,
  find_all: `export function find_all(s: string, pat: string): number[] {
  const out: number[] = [];
  if (pat === "") return out;
  for (let i = 0; i + pat.length <= s.length; i++) if (s.startsWith(pat, i)) out.push(i);
  return out;
}
`,
  heading_numbers: `export function heading_numbers(lines: string[]): string[] {
  const counters = [0, 0, 0];
  const out: string[] = [];
  for (const line of lines) {
    const m = /^(#{1,3}) (.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    counters[level - 1]++;
    for (let i = level; i < 3; i++) counters[i] = 0;
    out.push(counters.slice(0, level).join(".") + " " + m[2]);
  }
  return out;
}
`,
  parse_duration: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_duration(s: string): Result<number> {
  if (s === "") return { ok: false, error: "empty" };
  const units: Record<string, [number, number]> = { h: [1, 3600], m: [2, 60], s: [3, 1] };
  let total = 0;
  let digits = "";
  let last = 0;
  for (const c of s) {
    if (c >= "0" && c <= "9") {
      digits += c;
      continue;
    }
    const u = units[c];
    if (!u) return { ok: false, error: "unknown unit: " + c };
    if (digits === "") return { ok: false, error: "missing number before " + c };
    if (u[0] <= last) return { ok: false, error: "unit out of order: " + c };
    total += Number(digits) * u[1];
    last = u[0];
    digits = "";
  }
  if (digits !== "") return { ok: false, error: "missing unit" };
  return { ok: true, value: total };
}
`,
  parse_csv_line: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_csv_line(s: string): Result<string[]> {
  const fields: string[] = [];
  let cur = "";
  let state = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (state === 0 || state === 1) {
      if (c === ",") {
        fields.push(cur);
        cur = "";
        state = 0;
      } else if (c === '"') {
        if (state === 1) return { ok: false, error: "unexpected quote at " + i };
        state = 2;
      } else {
        cur += c;
        state = 1;
      }
    } else if (state === 2) {
      if (c === '"') state = 3;
      else cur += c;
    } else {
      if (c === '"') {
        cur += '"';
        state = 2;
      } else if (c === ",") {
        fields.push(cur);
        cur = "";
        state = 0;
      } else return { ok: false, error: "expected comma at " + i };
    }
  }
  if (state === 2) return { ok: false, error: "unterminated quote" };
  fields.push(cur);
  return { ok: true, value: fields };
}
`,
  parse_ipv4: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_ipv4(s: string): Result<number> {
  const parts = s.split(".");
  if (parts.length !== 4) return { ok: false, error: "expected 4 parts" };
  let total = 0;
  for (const p of parts) {
    if (!/^[0-9]{1,3}$/.test(p) || (p.length > 1 && p[0] === "0") || Number(p) > 255) {
      return { ok: false, error: "bad part: " + p };
    }
    total = total * 256 + Number(p);
  }
  return { ok: true, value: total };
}
`,
  compare_versions: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function valid(v: string): boolean {
  const parts = v.split(".");
  return parts.length <= 4 && parts.every((p) => /^[0-9]+$/.test(p));
}

export function compare_versions(a: string, b: string): Result<number> {
  if (!valid(a)) return { ok: false, error: "bad version: " + a };
  if (!valid(b)) return { ok: false, error: "bad version: " + b };
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return { ok: true, value: p < q ? -1 : 1 };
  }
  return { ok: true, value: 0 };
}
`,
  parse_money: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_money(s: string): Result<number> {
  const neg = s.startsWith("-");
  const rest = neg ? s.slice(1) : s;
  if (!rest.startsWith("$")) return { ok: false, error: "missing $" };
  const body = rest.slice(1);
  const dot = body.indexOf(".");
  const dollars = dot < 0 ? body : body.slice(0, dot);
  let cents = 0;
  if (dot >= 0) {
    const c = body.slice(dot + 1);
    if (!/^[0-9]{2}$/.test(c)) return { ok: false, error: "bad cents" };
    cents = Number(c);
  }
  const plain = dollars.replace(/,/g, "");
  const shapeOk = /^[0-9]+$/.test(dollars) || /^[0-9]{1,3}(,[0-9]{3})+$/.test(dollars);
  if (!shapeOk || (plain.length > 1 && plain[0] === "0")) return { ok: false, error: "bad dollars" };
  const total = Number(plain) * 100 + cents;
  return { ok: true, value: neg ? -total : total };
}
`,
};

const P2_TS: Record<string, string> = {
  eval_expr: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function eval_expr(s: string): Result<number> {
  const cs = s.split("").filter((c) => c !== " ");
  let i = 0;
  let divZero = false;
  class SyntaxErr extends Error {}
  const fail = (): never => {
    throw new SyntaxErr(i >= cs.length ? "unexpected end" : "unexpected character: " + cs[i]);
  };
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  function factor(): number {
    if (cs[i] === "(") {
      i++;
      const v = expr();
      if (cs[i] !== ")") fail();
      i++;
      return v;
    }
    if (!isDigit(cs[i])) fail();
    let n = 0;
    while (isDigit(cs[i])) n = n * 10 + Number(cs[i++]);
    return n;
  }
  function term(): number {
    let v = factor();
    while (cs[i] === "*" || cs[i] === "/") {
      const op = cs[i++];
      const r = factor();
      if (op === "*") v = v * r;
      else if (r === 0) {
        divZero = true;
        v = 0;
      } else v = Math.trunc(v / r);
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (cs[i] === "+" || cs[i] === "-") {
      const op = cs[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    if (i < cs.length) fail();
    if (divZero) return { ok: false, error: "division by zero" };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
`,
  tokenize: `type Token =
  | { kind: "Num"; value: number }
  | { kind: "Ident"; name: string }
  | { kind: "Sym"; text: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function tokenize(s: string): Result<Token[]> {
  const out: Token[] = [];
  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isStart = (c: string) => (c >= "a" && c <= "z") || c === "_";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    if (c === " ") i++;
    else if (isDigit(c)) {
      let j = i;
      while (j < s.length && isDigit(s[j])) j++;
      out.push({ kind: "Num", value: Number(s.slice(i, j)) });
      i = j;
    } else if (isStart(c)) {
      let j = i;
      while (j < s.length && (isStart(s[j]) || isDigit(s[j]))) j++;
      out.push({ kind: "Ident", name: s.slice(i, j) });
      i = j;
    } else if (["==", "<=", ">=", "!="].includes(two)) {
      out.push({ kind: "Sym", text: two });
      i += 2;
    } else if ("+-*/=<>(),".includes(c)) {
      out.push({ kind: "Sym", text: c });
      i++;
    } else return { ok: false, error: "unexpected character: " + c + " at " + i };
  }
  return { ok: true, value: out };
}
`,
  parse_config: `type Setting = { section: string; key: string; value: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_config(lines: string[]): Result<Setting[]> {
  const out: Setting[] = [];
  let section = "";
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    const tag = "line " + (n + 1) + ": ";
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      const inner = line.length >= 2 && line.endsWith("]") ? line.slice(1, -1).trim() : "";
      if (inner === "") return { ok: false, error: tag + "bad header" };
      section = inner;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) return { ok: false, error: tag + "missing =" };
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "") return { ok: false, error: tag + "empty key" };
    const existing = out.find((x) => x.section === section && x.key === key);
    if (existing) existing.value = value;
    else out.push({ section, key, value });
  }
  return { ok: true, value: out };
}
`,
  bracket_depth: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bracket_depth(s: string): Result<number> {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      best = Math.max(best, stack.length);
    } else if (c in pairs) {
      if (stack.length === 0 || stack[stack.length - 1] !== pairs[c]) return { ok: false, error: "mismatch at " + i };
      stack.pop();
    }
  }
  if (stack.length > 0) return { ok: false, error: "unclosed at end" };
  return { ok: true, value: best };
}
`,
  parse_query: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parse_query(s: string): Result<[string, string][]> {
  const out: [string, string][] = [];
  for (const item of s.split("&")) {
    if (item === "") continue;
    const eq = item.indexOf("=");
    const rawKey = eq < 0 ? item : item.slice(0, eq);
    const rawValue = eq < 0 ? "" : item.slice(eq + 1);
    const key = rawKey.split("+").join(" ");
    const value = rawValue.split("+").join(" ");
    if (key === "") return { ok: false, error: "empty key: " + item };
    out.push([key, value]);
  }
  return { ok: true, value: out };
}
`,
  flatten_nested: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function flatten_nested(s: string): Result<[number[], number]> {
  const t = s.split(" ").join("");
  let i = 0;
  const ints: number[] = [];
  let maxDepth = 0;
  class Bad extends Error {}
  const bad = (): never => {
    throw new Bad("invalid at " + i);
  };
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  function list(depth: number): void {
    if (t[i] !== "[") bad();
    i++;
    maxDepth = Math.max(maxDepth, depth);
    if (t[i] === "]") {
      i++;
      return;
    }
    for (;;) {
      if (t[i] === "[") list(depth + 1);
      else {
        const start = i;
        if (t[i] === "-") i++;
        if (!isDigit(t[i])) bad();
        while (isDigit(t[i])) i++;
        ints.push(Number(t.slice(start, i)));
      }
      if (t[i] === ",") i++;
      else if (t[i] === "]") {
        i++;
        return;
      } else bad();
    }
  }
  try {
    list(1);
    if (i < t.length) bad();
    return { ok: true, value: [ints, maxDepth] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
`,
  vending_machine: `type Event = { kind: "Coin"; cents: number } | { kind: "Select"; price: number } | { kind: "Refund" };

export function vending_machine(events: Event[]): string[] {
  const out: string[] = [];
  let credit = 0;
  for (const e of events) {
    if (e.kind === "Coin") {
      if ([5, 10, 25, 100].includes(e.cents)) credit += e.cents;
      else out.push("reject " + e.cents);
    } else if (e.kind === "Select") {
      if (credit >= e.price) {
        out.push("vend " + e.price + " change " + (credit - e.price));
        credit = 0;
      } else out.push("insufficient " + credit);
    } else if (credit > 0) {
      out.push("refund " + credit);
      credit = 0;
    }
  }
  if (credit > 0) out.push("refund " + credit);
  return out;
}
`,
  door_lock: `type Key = { kind: "Digit"; d: number } | { kind: "Enter" } | { kind: "Clear" };

export function door_lock(code: string, events: Key[]): string {
  let state = "locked";
  let buf = "";
  let fails = 0;
  for (const k of events) {
    if (state === "blocked") continue;
    if (state === "open") {
      if (k.kind === "Enter") {
        state = "locked";
        buf = "";
      }
      continue;
    }
    if (k.kind === "Digit") {
      buf += String(k.d);
      if (buf.length > code.length) buf = buf.slice(buf.length - code.length);
    } else if (k.kind === "Clear") buf = "";
    else {
      if (buf === code) {
        state = "open";
        fails = 0;
      } else {
        fails++;
        if (fails >= 3) state = "blocked";
      }
      buf = "";
    }
  }
  return state;
}
`,
  stack_vm: `type Instr =
  | { kind: "Push"; n: number }
  | { kind: "Pop" }
  | { kind: "Add" }
  | { kind: "Sub" }
  | { kind: "Mul" }
  | { kind: "Dup" }
  | { kind: "Swap" }
  | { kind: "Jz"; target: number }
  | { kind: "Jmp"; target: number }
  | { kind: "Print" }
  | { kind: "Halt" };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function stack_vm(prog: Instr[]): Result<number[]> {
  const stack: number[] = [];
  const out: number[] = [];
  let pc = 0;
  let steps = 0;
  const need: Record<string, number> = { Push: 0, Pop: 1, Add: 2, Sub: 2, Mul: 2, Dup: 1, Swap: 2, Jz: 1, Jmp: 0, Print: 1, Halt: 0 };
  while (pc < prog.length) {
    if (steps === 1000) return { ok: false, error: "step limit exceeded" };
    steps++;
    const ins = prog[pc];
    if (stack.length < need[ins.kind]) return { ok: false, error: "stack underflow at " + pc };
    if ((ins.kind === "Jz" || ins.kind === "Jmp") && (ins.target < 0 || ins.target >= prog.length)) {
      return { ok: false, error: "bad jump at " + pc };
    }
    let next = pc + 1;
    switch (ins.kind) {
      case "Push":
        stack.push(ins.n);
        break;
      case "Pop":
        stack.pop();
        break;
      case "Add":
      case "Sub":
      case "Mul": {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(ins.kind === "Add" ? a + b : ins.kind === "Sub" ? a - b : a * b);
        break;
      }
      case "Dup":
        stack.push(stack[stack.length - 1]);
        break;
      case "Swap": {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(b, a);
        break;
      }
      case "Jz":
        if (stack.pop() === 0) next = ins.target;
        break;
      case "Jmp":
        next = ins.target;
        break;
      case "Print":
        out.push(stack.pop()!);
        break;
      case "Halt":
        next = prog.length;
        break;
    }
    pc = next;
  }
  return { ok: true, value: out };
}
`,
  text_editor: `type EditOp =
  | { kind: "Insert"; text: string }
  | { kind: "Delete"; n: number }
  | { kind: "Left"; n: number }
  | { kind: "Right"; n: number }
  | { kind: "Undo" };

export function text_editor(ops: EditOp[]): string {
  let text = "";
  let cur = 0;
  const history: [string, number][] = [];
  for (const op of ops) {
    switch (op.kind) {
      case "Insert":
        history.push([text, cur]);
        text = text.slice(0, cur) + op.text + text.slice(cur);
        cur += op.text.length;
        break;
      case "Delete": {
        history.push([text, cur]);
        const k = Math.min(op.n, cur);
        text = text.slice(0, cur - k) + text.slice(cur);
        cur -= k;
        break;
      }
      case "Left":
        cur = Math.max(0, cur - op.n);
        break;
      case "Right":
        cur = Math.min(text.length, cur + op.n);
        break;
      case "Undo": {
        const prev = history.pop();
        if (prev) [text, cur] = prev;
        break;
      }
    }
  }
  return text;
}
`,
  order_states: `type OrderEvent =
  | { kind: "Create"; id: string }
  | { kind: "Pay"; id: string }
  | { kind: "Ship"; id: string }
  | { kind: "Cancel"; id: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function order_states(events: OrderEvent[]): Result<[string, string][]> {
  const states = new Map<string, string>();
  const rules: Record<string, [string[], string]> = {
    Pay: [["created"], "paid"],
    Ship: [["paid"], "shipped"],
    Cancel: [["created", "paid"], "cancelled"],
  };
  for (const e of events) {
    const cur = states.get(e.id);
    if (e.kind === "Create") {
      if (cur !== undefined) return { ok: false, error: "duplicate order: " + e.id };
      states.set(e.id, "created");
      continue;
    }
    if (cur === undefined) return { ok: false, error: "unknown order: " + e.id };
    const [from, to] = rules[e.kind];
    if (!from.includes(cur)) return { ok: false, error: "cannot " + e.kind.toLowerCase() + " " + e.id + " from " + cur };
    states.set(e.id, to);
  }
  const out = [...states.entries()];
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { ok: true, value: out };
}
`,
  robot_walk: `type Cmd = { kind: "Forward"; steps: number } | { kind: "TurnLeft" } | { kind: "TurnRight" };

export function robot_walk(cmds: Cmd[], obstacles: [number, number][]): [number, number, string] {
  const dirs = ["N", "E", "S", "W"];
  const dx = [0, 1, 0, -1];
  const dy = [1, 0, -1, 0];
  const blocked = new Set(obstacles.map(([x, y]) => x + "," + y));
  let x = 0;
  let y = 0;
  let d = 0;
  for (const c of cmds) {
    if (c.kind === "TurnLeft") d = (d + 3) % 4;
    else if (c.kind === "TurnRight") d = (d + 1) % 4;
    else {
      for (let k = 0; k < c.steps; k++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (blocked.has(nx + "," + ny)) break;
        x = nx;
        y = ny;
      }
    }
  }
  return [x, y, dirs[d]];
}
`,
  bank_ledger: `type BankOp =
  | { kind: "Open"; name: string }
  | { kind: "Deposit"; name: string; amount: number }
  | { kind: "Withdraw"; name: string; amount: number }
  | { kind: "Transfer"; src: string; dst: string; amount: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bank_ledger(ops: BankOp[]): Result<[string, number][]> {
  const bal = new Map<string, number>();
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const fail = (msg: string): Result<[string, number][]> => ({ ok: false, error: "step " + (i + 1) + ": " + msg });
    if (op.kind === "Open") {
      if (bal.has(op.name)) return fail("duplicate account " + op.name);
      bal.set(op.name, 0);
    } else if (op.kind === "Transfer") {
      if (!bal.has(op.src)) return fail("unknown account " + op.src);
      if (!bal.has(op.dst)) return fail("unknown account " + op.dst);
      if (op.src === op.dst) return fail("same account");
      if (op.amount <= 0) return fail("invalid amount");
      if (op.amount > bal.get(op.src)!) return fail("insufficient funds");
      bal.set(op.src, bal.get(op.src)! - op.amount);
      bal.set(op.dst, bal.get(op.dst)! + op.amount);
    } else {
      if (!bal.has(op.name)) return fail("unknown account " + op.name);
      if (op.amount <= 0) return fail("invalid amount");
      if (op.kind === "Withdraw") {
        if (op.amount > bal.get(op.name)!) return fail("insufficient funds");
        bal.set(op.name, bal.get(op.name)! - op.amount);
      } else bal.set(op.name, bal.get(op.name)! + op.amount);
    }
  }
  return { ok: true, value: [...bal.entries()] };
}
`,
  parking_fees: `type Park = { kind: "Arrive"; plate: string; minute: number } | { kind: "Leave"; plate: string; minute: number };

export function parking_fees(events: Park[]): [string, number][] {
  const parked = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.kind === "Arrive") {
      if (!parked.has(e.plate)) parked.set(e.plate, e.minute);
    } else {
      const start = parked.get(e.plate);
      if (start === undefined) continue;
      parked.delete(e.plate);
      const d = e.minute - start;
      const fee = d <= 30 ? 0 : Math.min(1000, 200 * Math.ceil((d - 30) / 60));
      totals.set(e.plate, (totals.get(e.plate) ?? 0) + fee);
    }
  }
  return [...totals.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
`,
  glob_match: `export function glob_match(pattern: string, s: string): boolean {
  type Tok = { kind: "star" } | { kind: "any" } | { kind: "lit"; ch: string };
  const toks: Tok[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\\\") {
      if (i + 1 < pattern.length) toks.push({ kind: "lit", ch: pattern[++i] });
      else toks.push({ kind: "lit", ch: "\\\\" });
    } else if (c === "*") toks.push({ kind: "star" });
    else if (c === "?") toks.push({ kind: "any" });
    else toks.push({ kind: "lit", ch: c });
  }
  let row: boolean[] = [true, ...Array.from({ length: s.length }, () => false)];
  for (const t of toks) {
    const next: boolean[] = [];
    if (t.kind === "star") {
      let acc = false;
      for (const b of row) next.push((acc = acc || b));
    } else {
      next.push(false);
      for (let j = 1; j <= s.length; j++) next.push(row[j - 1] && (t.kind === "any" || s[j - 1] === t.ch));
    }
    row = next;
  }
  return row[s.length];
}
`,
};

const P3_TS: Record<string, string> = {
  league_table: `type Match = { home: string; away: string; home_goals: number; away_goals: number };

export function league_table(matches: Match[]): [string, number, number, number][] {
  const order: string[] = [];
  const stats = new Map<string, { pts: number; gf: number; ga: number }>();
  const get = (t: string) => {
    let s = stats.get(t);
    if (!s) {
      s = { pts: 0, gf: 0, ga: 0 };
      stats.set(t, s);
      order.push(t);
    }
    return s;
  };
  for (const m of matches) {
    const h = get(m.home);
    const a = get(m.away);
    h.gf += m.home_goals;
    h.ga += m.away_goals;
    a.gf += m.away_goals;
    a.ga += m.home_goals;
    if (m.home_goals > m.away_goals) h.pts += 3;
    else if (m.home_goals < m.away_goals) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  const rows: [string, number, number, number][] = order.map((t) => {
    const s = stats.get(t)!;
    return [t, s.pts, s.gf - s.ga, s.gf];
  });
  rows.sort((x, y) => y[1] - x[1] || y[2] - x[2] || y[3] - x[3] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return rows;
}
`,
  payroll_by_dept: `type Employee = { name: string; dept: string; hours: number; rate_cents: number };

export function payroll_by_dept(emps: Employee[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const e of emps) {
    const pay = e.hours <= 40 ? e.hours * e.rate_cents : 40 * e.rate_cents + Math.floor(((e.hours - 40) * e.rate_cents * 3) / 2);
    totals.set(e.dept, (totals.get(e.dept) ?? 0) + pay);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
`,
  build_order: `type Job = { name: string; deps: string[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function build_order(jobs: Job[]): Result<string[]> {
  const names = new Set<string>();
  for (const j of jobs) {
    if (names.has(j.name)) return { ok: false, error: "duplicate job: " + j.name };
    names.add(j.name);
  }
  for (const j of jobs) {
    for (const d of j.deps) {
      if (!names.has(d)) return { ok: false, error: "unknown dependency: " + d };
    }
  }
  const done: string[] = [];
  const placed = new Set<string>();
  while (done.length < jobs.length) {
    const next = jobs.find((j) => !placed.has(j.name) && j.deps.every((d) => placed.has(d)));
    if (!next) return { ok: false, error: "cycle detected" };
    placed.add(next.name);
    done.push(next.name);
  }
  return { ok: true, value: done };
}
`,
  top_product_per_region: `type Sale = { region: string; product: string; units: number; price_cents: number };

export function top_product_per_region(sales: Sale[]): [string, string, number][] {
  const byRegion = new Map<string, Map<string, number>>();
  for (const s of sales) {
    let m = byRegion.get(s.region);
    if (!m) {
      m = new Map();
      byRegion.set(s.region, m);
    }
    m.set(s.product, (m.get(s.product) ?? 0) + s.units * s.price_cents);
  }
  const regions = [...byRegion.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return regions.map((r) => {
    let best: [string, number] | null = null;
    for (const [p, v] of byRegion.get(r)!) {
      if (best === null || v > best[1] || (v === best[1] && p < best[0])) best = [p, v];
    }
    return [r, best![0], best![1]];
  });
}
`,
  free_slots: `type Meeting = { start: number; end: number };

export function free_slots(meetings: Meeting[], day_start: number, day_end: number): [number, number][] {
  const ms = meetings.filter((m) => m.end > m.start).sort((a, b) => a.start - b.start);
  const out: [number, number][] = [];
  let cur = day_start;
  for (const m of ms) {
    const s = Math.min(m.start, day_end);
    if (s > cur) out.push([cur, s]);
    cur = Math.max(cur, m.end);
  }
  if (day_end > cur) out.push([cur, day_end]);
  return out;
}
`,
  invoice_total: `type Line = { sku: string; qty: number; unit_cents: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function invoice_total(lines: Line[], coupon: string): Result<number> {
  for (const l of lines) {
    if (l.qty < 1) return { ok: false, error: "bad quantity: " + l.sku };
  }
  let sub = 0;
  for (const l of lines) {
    const a = l.qty * l.unit_cents;
    sub += l.qty >= 10 ? a - Math.floor(a / 10) : a;
  }
  let amount: number;
  if (coupon === "") amount = sub;
  else if (coupon === "SAVE500") amount = Math.max(sub - 500, 0);
  else if (coupon === "PCT10") amount = sub - Math.floor(sub / 10);
  else if (coupon === "BIG20") {
    if (sub < 10000) return { ok: false, error: "coupon not applicable: BIG20" };
    amount = sub - Math.floor(sub / 5);
  } else return { ok: false, error: "unknown coupon: " + coupon };
  return { ok: true, value: amount + Math.floor((amount * 8 + 50) / 100) };
}
`,
  inventory_ledger: `type Stock = { sku: string; qty: number };
type Txn = { sku: string; delta: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function inventory_ledger(stock: Stock[], txns: Txn[]): Result<Stock[]> {
  const m = new Map<string, number>();
  for (const s of stock) m.set(s.sku, s.qty);
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    const cur = m.get(t.sku);
    if (cur === undefined) return { ok: false, error: "txn " + (i + 1) + ": unknown sku " + t.sku };
    const q = cur + t.delta;
    if (q < 0) return { ok: false, error: "txn " + (i + 1) + ": " + t.sku + " would go negative" };
    m.set(t.sku, q);
  }
  const out: Stock[] = [...m].filter((p) => p[1] > 0).map(([sku, qty]) => ({ sku, qty }));
  out.sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  return { ok: true, value: out };
}
`,
  student_medians: `type Student = { name: string; scores: number[] };

export function student_medians(students: Student[]): [string, number][] {
  const rows: [string, number][] = [];
  for (const s of students) {
    if (s.scores.length === 0) continue;
    const xs = [...s.scores].sort((a, b) => a - b);
    const n = xs.length;
    rows.push([s.name, n % 2 === 1 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2]);
  }
  rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return rows;
}
`,
  latency_report: `type Request = { endpoint: string; ms: number; status: number };

export function latency_report(entries: Request[]): [string, number, number, number][] {
  const groups = new Map<string, Request[]>();
  for (const e of entries) {
    const g = groups.get(e.endpoint);
    if (g) g.push(e);
    else groups.set(e.endpoint, [e]);
  }
  return [...groups].map(([ep, rs]) => {
    const n = rs.length;
    const k = Math.floor((9 * n + 9) / 10);
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    return [ep, n, ms[k - 1], rs.filter((r) => r.status >= 500).length];
  });
}
`,
  competition_rank: `type Player = { name: string; score: number };

export function competition_rank(players: Player[]): [number, string][] {
  const sorted = [...players].sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return sorted.map((p) => [1 + players.filter((q) => q.score > p.score).length, p.name]);
}
`,
  settle_debts: `type Expense = { payer: string; amount_cents: number };

export function settle_debts(expenses: Expense[], people: string[]): [string, string, number][] {
  const n = people.length;
  const total = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const share = Math.floor(total / n);
  const extra = total % n;
  const bal = people.map((p, i) => {
    const paid = expenses.filter((e) => e.payer === p).reduce((a, e) => a + e.amount_cents, 0);
    return paid - share - (i < extra ? 1 : 0);
  });
  const out: [string, string, number][] = [];
  for (;;) {
    let d = -1;
    let c = -1;
    for (let i = 0; i < n; i++) {
      if (bal[i] < 0 && (d < 0 || bal[i] < bal[d])) d = i;
      if (bal[i] > 0 && (c < 0 || bal[i] > bal[c])) c = i;
    }
    if (d < 0 || c < 0) break;
    const amt = Math.min(-bal[d], bal[c]);
    out.push([people[d], people[c], amt]);
    bal[d] += amt;
    bal[c] -= amt;
  }
  return out;
}
`,
  coverage_gaps: `type Shift = { worker: string; start_hour: number; end_hour: number };

export function coverage_gaps(shifts: Shift[], required: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < 24; h++) {
    const ws = new Set(shifts.filter((s) => s.start_hour <= h && h < s.end_hour).map((s) => s.worker));
    if (ws.size < required) out.push(h);
  }
  return out;
}
`,
  session_totals: `type Session = { user: string; kind: string; time: number };

export function session_totals(events: Session[]): [string, number][] {
  const totals = new Map<string, number>();
  const open = new Map<string, number>();
  for (const e of events) {
    if (!totals.has(e.user)) totals.set(e.user, 0);
    if (e.kind === "login") {
      if (!open.has(e.user)) open.set(e.user, e.time);
    } else if (open.has(e.user)) {
      totals.set(e.user, totals.get(e.user)! + e.time - open.get(e.user)!);
      open.delete(e.user);
    }
  }
  const end = events.length ? events[events.length - 1].time : 0;
  for (const [u, t] of open) totals.set(u, totals.get(u)! + end - t);
  return [...totals].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
`,
  merge_contacts: `type Contact = { name: string; email: string; phone: string };

export function merge_contacts(contacts: Contact[]): Contact[] {
  const n = contacts.length;
  const parent = contacts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = contacts[i];
      const b = contacts[j];
      const ea = a.email.trim();
      const pa = digits(a.phone);
      if ((ea !== "" && ea === b.email.trim()) || (pa !== "" && pa === digits(b.phone))) {
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
      }
    }
  }
  const groups = new Map<number, Contact>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const c = contacts[i];
    const g = groups.get(r);
    if (!g) groups.set(r, { name: c.name, email: c.email, phone: c.phone });
    else {
      if (g.name === "") g.name = c.name;
      if (g.email === "") g.email = c.email;
      if (g.phone === "") g.phone = c.phone;
    }
  }
  return [...groups.values()];
}
`,
  age_histogram: `type Person = { name: string; age: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function age_histogram(people: Person[], width: number): Result<[string, number][]> {
  if (width < 1) return { ok: false, error: "bad width" };
  for (const p of people) {
    if (p.age < 0) return { ok: false, error: "negative age: " + p.name };
  }
  if (people.length === 0) return { ok: true, value: [] };
  const bs = people.map((p) => Math.floor(p.age / width));
  const lo = Math.min(...bs);
  const hi = Math.max(...bs);
  const out: [string, number][] = [];
  for (let b = lo; b <= hi; b++) {
    out.push([b * width + "-" + (b * width + width - 1), bs.filter((x) => x === b).length]);
  }
  return { ok: true, value: out };
}
`,
};

const P4_TS: Record<string, string> = {
  max_subarray: `export function max_subarray(xs: number[]): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  for (let i = 0; i < xs.length; i++) {
    let s = 0;
    for (let j = i; j < xs.length; j++) {
      s += xs[j];
      if (best === null || s > best[0]) best = [s, i, j];
    }
  }
  return best;
}
`,
  lis_length: `export function lis_length(xs: number[]): [number, number] {
  const n = xs.length;
  if (n === 0) return [0, 0];
  const len: number[] = [];
  const cnt: number[] = [];
  for (let i = 0; i < n; i++) {
    len.push(1);
    cnt.push(1);
    for (let j = 0; j < i; j++) {
      if (xs[j] < xs[i]) {
        if (len[j] + 1 > len[i]) {
          len[i] = len[j] + 1;
          cnt[i] = cnt[j];
        } else if (len[j] + 1 === len[i]) {
          cnt[i] += cnt[j];
        }
      }
    }
  }
  const best = Math.max(...len);
  let total = 0;
  for (let i = 0; i < n; i++) if (len[i] === best) total += cnt[i];
  return [best, total];
}
`,
  spiral_order: `export function spiral_order(m: number[][]): number[] {
  const out: number[] = [];
  if (m.length === 0 || m[0].length === 0) return out;
  let top = 0;
  let bottom = m.length - 1;
  let left = 0;
  let right = m[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let r = top; r <= bottom; r++) out.push(m[r][left]);
    for (let c = left + 1; c <= right; c++) out.push(m[bottom][c]);
    if (left < right) for (let r = bottom - 1; r >= top; r--) out.push(m[r][right]);
    if (top < bottom) for (let c = right - 1; c > left; c--) out.push(m[top][c]);
    top++;
    bottom--;
    left++;
    right--;
  }
  return out;
}
`,
  next_permutation: `export function next_permutation(xs: number[]): number[] {
  const a = [...xs];
  let i = a.length - 2;
  while (i >= 0 && a[i] >= a[i + 1]) i--;
  if (i < 0) return a.sort((x, y) => x - y);
  let j = a.length - 1;
  while (a[j] <= a[i]) j--;
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
  const tail = a.slice(i + 1).reverse();
  return a.slice(0, i + 1).concat(tail);
}
`,
  k_most_frequent: `export function k_most_frequent(xs: number[], k: number): [number, number][] {
  if (k <= 0) return [];
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const pairs: [number, number][] = [...counts.entries()];
  pairs.sort((p, q) => q[1] - p[1] || p[0] - q[0]);
  return pairs.slice(0, k);
}
`,
  sliding_window_max: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function sliding_window_max(xs: number[], k: number): Result<number[]> {
  if (k < 1) return { ok: false, error: "window must be positive" };
  if (k > xs.length) return { ok: false, error: "window larger than input" };
  const out: number[] = [];
  for (let i = 0; i + k <= xs.length; i++) out.push(Math.max(...xs.slice(i, i + k)));
  return { ok: true, value: out };
}
`,
  min_coins: `export function min_coins(coins: number[], amount: number): [number, number[]] | null {
  if (amount < 0) return null;
  const best: (number | null)[] = [0];
  for (let a = 1; a <= amount; a++) {
    let b: number | null = null;
    for (const c of coins) {
      const p = a - c >= 0 ? best[a - c] : null;
      if (p !== null && p !== undefined && (b === null || p + 1 < b)) b = p + 1;
    }
    best.push(b);
  }
  if (best[amount] === null) return null;
  const used: number[] = [];
  let a = amount;
  const desc = [...coins].sort((x, y) => y - x);
  while (a > 0) {
    const need = (best[a] as number) - 1;
    const c = desc.find((c) => (used.length === 0 || c <= used[used.length - 1]) && a - c >= 0 && best[a - c] === need)!;
    used.push(c);
    a -= c;
  }
  return [used.length, used];
}
`,
  edit_script_distance: `export function edit_script_distance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= n; i++) {
    d.push([]);
    for (let j = 0; j <= m; j++) {
      if (i === 0) d[i].push(j);
      else if (j === 0) d[i].push(i);
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i].push(v);
      }
    }
  }
  return d[n][m];
}
`,
  bowling_score: `type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bowling_score(rolls: number[]): Result<number> {
  const fail = (error: string): Result<number> => ({ ok: false, error });
  if (rolls.some((r) => r < 0 || r > 10)) return fail("invalid roll");
  let i = 0;
  let score = 0;
  const at = (k: number) => rolls[k];
  for (let frame = 1; frame <= 9; frame++) {
    if (i >= rolls.length) return fail("incomplete game");
    if (at(i) === 10) {
      i += 1;
      continue;
    }
    if (i + 1 >= rolls.length) return fail("incomplete game");
    if (at(i) + at(i + 1) > 10) return fail("too many pins in frame " + frame);
    i += 2;
  }
  // frame 10
  if (i + 1 >= rolls.length) return fail("incomplete game");
  let tenth: number;
  if (at(i) === 10) {
    if (i + 2 >= rolls.length) return fail("incomplete game");
    if (at(i + 1) !== 10 && at(i + 1) + at(i + 2) > 10) return fail("too many pins in frame 10");
    tenth = 3;
  } else {
    if (at(i) + at(i + 1) > 10) return fail("too many pins in frame 10");
    if (at(i) + at(i + 1) === 10) {
      if (i + 2 >= rolls.length) return fail("incomplete game");
      tenth = 3;
    } else tenth = 2;
  }
  if (i + tenth < rolls.length) return fail("too many rolls");
  // scoring
  let k = 0;
  for (let frame = 1; frame <= 9; frame++) {
    if (rolls[k] === 10) {
      score += 10 + rolls[k + 1] + rolls[k + 2];
      k += 1;
    } else if (rolls[k] + rolls[k + 1] === 10) {
      score += 10 + rolls[k + 2];
      k += 2;
    } else {
      score += rolls[k] + rolls[k + 1];
      k += 2;
    }
  }
  for (; k < rolls.length; k++) score += rolls[k];
  return { ok: true, value: score };
}
`,
  tennis_score: `export function tennis_score(points: string): string {
  const names = ["love", "15", "30", "40"];
  let a = 0;
  let b = 0;
  let over = false;
  for (const c of points) {
    if (over) return "error: point after game";
    if (c === "A") a++;
    else if (c === "B") b++;
    else return "error: bad point";
    if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) over = true;
  }
  if (over) return a > b ? "game A" : "game B";
  if (a >= 3 && b >= 3) {
    if (a === b) return "deuce";
    return a > b ? "advantage A" : "advantage B";
  }
  if (a === b) return names[a] + "-all";
  return names[a] + "-" + names[b];
}
`,
  life_step: `export function life_step(grid: string[], steps: number): string[] {
  let g = grid.map((row) => row.split(""));
  for (let s = 0; s < steps; s++) {
    g = g.map((row, r) =>
      row.map((cell, c) => {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (g[r + dr]?.[c + dc] === "#") n++;
          }
        return (cell === "#" && (n === 2 || n === 3)) || (cell !== "#" && n === 3) ? "#" : ".";
      }),
    );
  }
  return g.map((row) => row.join(""));
}
`,
  tic_tac_toe: `export function tic_tac_toe(board: string[]): string {
  const cells = board.join("").split("");
  const nx = cells.filter((c) => c === "X").length;
  const no = cells.filter((c) => c === "O").length;
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const has = (p: string) => lines.some((l) => l.every((i) => cells[i] === p));
  const xw = has("X");
  const ow = has("O");
  if (nx !== no && nx !== no + 1) return "invalid";
  if (xw && ow) return "invalid";
  if (xw && nx !== no + 1) return "invalid";
  if (ow && nx !== no) return "invalid";
  if (xw) return "X wins";
  if (ow) return "O wins";
  if (nx + no === 9) return "draw";
  return "in progress";
}
`,
  poker_hand: `export function poker_hand(cards: string[]): string {
  const RANKS = "23456789TJQKA";
  if (cards.length !== 5 || new Set(cards).size !== 5) return "invalid";
  for (const c of cards) if (c.length !== 2 || !RANKS.includes(c[0]) || !"CDHS".includes(c[1])) return "invalid";
  const ranks = cards.map((c) => RANKS.indexOf(c[0])).sort((x, y) => x - y);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const distinct = new Set(ranks).size === 5;
  const straight = distinct && (ranks[4] - ranks[0] === 4 || ranks.join(",") === "0,1,2,3,12");
  const counts = [...new Set(ranks)].map((r) => ranks.filter((x) => x === r).length).sort((x, y) => y - x);
  if (straight && flush) return "straight flush";
  if (counts[0] === 4) return "four of a kind";
  if (counts[0] === 3 && counts[1] === 2) return "full house";
  if (flush) return "flush";
  if (straight) return "straight";
  if (counts[0] === 3) return "three of a kind";
  if (counts[0] === 2 && counts[1] === 2) return "two pair";
  if (counts[0] === 2) return "one pair";
  return "high card";
}
`,
  count_islands: `export function count_islands(grid: string[]): [number, number] {
  const seen = new Set<string>();
  let count = 0;
  let largest = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== "#" || seen.has(r + "," + c)) continue;
      count++;
      let size = 0;
      const stack: [number, number][] = [[r, c]];
      seen.add(r + "," + c);
      while (stack.length > 0) {
        const [y, x] = stack.pop()!;
        size++;
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy;
          const nx = x + dx;
          if (grid[ny]?.[nx] === "#" && !seen.has(ny + "," + nx)) {
            seen.add(ny + "," + nx);
            stack.push([ny, nx]);
          }
        }
      }
      largest = Math.max(largest, size);
    }
  }
  return [count, largest];
}
`,
  elevator_scan: `export function elevator_scan(start: number, requests: number[], direction: string): number[] {
  const floors = [...new Set(requests)];
  const above = floors.filter((f) => f > start).sort((a, b) => a - b);
  const below = floors.filter((f) => f < start).sort((a, b) => b - a);
  const here = floors.includes(start) ? [start] : [];
  return direction === "up" ? [...here, ...above, ...below] : [...here, ...below, ...above];
}
`,
};

export const REFERENCE_TS: Record<string, string> = { ...P1_TS, ...P2_TS, ...P3_TS, ...P4_TS };
