/** Independent reference solutions, used only to validate the task set's expected values. */
const words = (s: string) => (s === "" ? [] : s.split(" "));
const isInt = (s: string) => /^-?\d+$/.test(s);

const ok = (value: unknown) => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });

export const REFERENCE: Record<string, (...a: any[]) => unknown> = {
  sum_evens: (xs: number[]) => xs.filter((x) => x % 2 === 0).reduce((a, b) => a + b, 0),
  count_vowels: (s: string) => [...s].filter((c) => "aeiou".includes(c)).length,
  reverse_words: (s: string) => s.split(" ").reverse().join(" "),
  fizzbuzz_list: (n: number) =>
    Array.from({ length: n }, (_, i) => i + 1).map((k) => (k % 15 === 0 ? "FizzBuzz" : k % 3 === 0 ? "Fizz" : k % 5 === 0 ? "Buzz" : String(k))),
  max_or_none: (xs: number[]) => (xs.length ? Math.max(...xs) : null),
  is_palindrome: (s: string) => [...s].reverse().join("") === s,
  factorial: (n: number) => (n <= 1 ? 1 : n * (REFERENCE.factorial(n - 1) as number)),
  fib: (n: number) => {
    let [a, b] = [0, 1];
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
  },
  gcd: (a: number, b: number): number => (b === 0 ? a : (REFERENCE.gcd(b, a % b) as number)),
  is_prime: (n: number) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  },
  digit_sum: (n: number) => [...String(n)].reduce((a, c) => a + Number(c), 0),
  average: (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  running_total: (xs: number[]) => xs.map((_, i) => xs.slice(0, i + 1).reduce((a, b) => a + b, 0)),
  dedupe: (xs: number[]) => [...new Set(xs)],
  count_word: (s: string, w: string) => words(s).filter((x) => x === w).length,
  longest_word: (s: string) => words(s).reduce((best, w) => (w.length > best.length ? w : best), ""),
  clamp: (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi),
  second_largest: (xs: number[]) => {
    const d = [...new Set(xs)].sort((a, b) => b - a);
    return d.length >= 2 ? d[1] : null;
  },
  merge_sorted: (a: number[], b: number[]) => [...a, ...b].sort((x, y) => x - y),
  chunk: (xs: number[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n)),
  flatten: (xss: number[][]) => xss.flat(),
  zip_sum: (a: number[], b: number[]) => a.slice(0, Math.min(a.length, b.length)).map((x, i) => x + b[i]),
  index_of: (xs: number[], x: number) => (xs.indexOf(x) >= 0 ? xs.indexOf(x) : null),
  count_greater: (xs: number[], l: number) => xs.filter((x) => x > l).length,
  word_lengths: (s: string) => words(s).map((w) => w.length),
  repeat_string: (s: string, n: number) => s.repeat(n),
  join_ints: (xs: number[], sep: string) => xs.join(sep),
  parse_sum: (s: string) => s.split(",").filter(isInt).reduce((a, x) => a + Number(x), 0),
  min_max: (xs: number[]) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null),
  pairs_summing: (xs: number[], t: number) => {
    let n = 0;
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[i] + xs[j] === t) n++;
    return n;
  },
  rotate_left: (xs: number[], k: number) => (xs.length ? [...xs.slice(k % xs.length), ...xs.slice(0, k % xs.length)] : []),
  balanced_parens: (s: string) => {
    let d = 0;
    for (const c of s) {
      if (c === "(") d++;
      if (c === ")" && --d < 0) return false;
    }
    return d === 0;
  },
  collatz_steps: (n: number) => {
    let s = 0;
    while (n !== 1) {
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
      s++;
    }
    return s;
  },
  binary_string: (n: number) => n.toString(2),
  mean_above: (xs: number[], l: number) => {
    const f = xs.filter((x) => x > l);
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  },
  most_common_word: (s: string) => {
    const ws = words(s);
    if (!ws.length) return null;
    const counts = new Map<string, number>();
    for (const w of ws) counts.set(w, (counts.get(w) ?? 0) + 1);
    let best = ws[0];
    for (const [w, c] of counts) if (c > counts.get(best)!) best = w;
    return best;
  },
  triangle_numbers: (n: number) => Array.from({ length: n }, (_, i) => ((i + 1) * (i + 2)) / 2),
  count_char: (s: string, c: string) => [...s].filter((x) => x === c).length,
  safe_div: (a: number, b: number) => (b === 0 ? null : Math.trunc(a / b)),
  grade: (s: number) => (s >= 90 ? "A" : s >= 80 ? "B" : s >= 70 ? "C" : s >= 60 ? "D" : "F"),
  total_area: (shapes: any[]) =>
    shapes.reduce((a, s) => a + (s.kind === "Circle" ? 3.14159 * s.radius * s.radius : s.kind === "Rect" ? s.width * s.height : (s.base * s.height) / 2), 0),
  parse_pairs: (s: string) => {
    if (s === "") return ok([]);
    const out: [string, number][] = [];
    for (const item of s.split(";")) {
      const parts = item.split("=");
      if (parts.length !== 2 || !isInt(parts[1])) return err(`bad item: ${item}`);
      out.push([parts[0], Number(parts[1])]);
    }
    return ok(out);
  },
  restock: (items: any[]) =>
    items.filter((i) => i.qty < i.min).map((i, k) => [i, k] as const)
      .sort((a, b) => b[0].min - b[0].qty - (a[0].min - a[0].qty) || a[1] - b[1]).map(([i]) => i.sku),
  apply_ops: (balance: number, ops: any[]) => {
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].kind === "Deposit") balance += ops[i].amount;
      else if (ops[i].amount > balance) return err(`insufficient funds at step ${i + 1}`);
      else balance -= ops[i].amount;
    }
    return ok(balance);
  },
  rpn: (tokens: string[]) => {
    const st: number[] = [];
    for (const t of tokens) {
      if (isInt(t)) st.push(Number(t));
      else if (["+", "-", "*", "/"].includes(t)) {
        if (st.length < 2) return err("stack underflow");
        const b = st.pop()!;
        const a = st.pop()!;
        if (t === "/" && b === 0) return err("division by zero");
        st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
      } else return err(`bad token: ${t}`);
    }
    return st.length === 1 ? ok(st[0]) : err("expected one value");
  },
  word_counts_sorted: (s: string) => {
    const counts = new Map<string, number>();
    for (const w of words(s)) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts].map((p, k) => [p, k] as const).sort((a, b) => b[0][1] - a[0][1] || a[1] - b[1]).map(([p]) => p);
  },
  transpose: (m: number[][]) => (m.length ? m[0].map((_, j) => m.map((row) => row[j])) : []),
  run_lengths: (s: string) => {
    const out: [string, number][] = [];
    for (const c of s) {
      if (out.length && out[out.length - 1][0] === c) out[out.length - 1][1]++;
      else out.push([c, 1]);
    }
    return out;
  },
  validate_user: (u: any) => [
    ...(u.name === "" ? ["name is empty"] : []),
    ...(u.age < 0 || u.age > 150 ? ["age out of range"] : []),
    ...(u.email.includes("@") ? [] : ["email must contain @"]),
  ],
  report_card: (students: any[]) =>
    students.map((s) => {
      const avg = s.scores.length ? Math.trunc(s.scores.reduce((a: number, b: number) => a + b, 0) / s.scores.length) : 0;
      return [s.name, avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "F"];
    }),
};
