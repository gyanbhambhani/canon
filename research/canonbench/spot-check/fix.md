# Spot check: FIX mutants (10%)

Check: the mutant is a plausible bug, and the failing example is right.

## parse_csv_line.constant.canon

Mutation (constant) at line 39: `2` -> `1`

Failing example: {"args":["a,b,c"],"expected":{"ok":true,"value":["a","b","c"]},"actual":{"ok":false,"error":"unterminated quote"}}

```canon
fn parse_csv_line(s: String) -> Result[List[String], String] {
  var fields = []
  var cur = ""
  var state = 0
  for p in enumerate(split(s, "")) {
    let i = p.0
    let c = p.1
    if state == 0 || state == 1 {
      if c == "," {
        fields = append(fields, cur)
        cur = ""
        state = 0
      } else if c == "\"" {
        if state == 1 {
          return Err("unexpected quote at " + to_string(i))
        }
        state = 2
      } else {
        cur = cur + c
        state = 1
      }
    } else if state == 2 {
      if c == "\"" {
        state = 3
      } else {
        cur = cur + c
      }
    } else if c == "\"" {
      cur = cur + "\""
      state = 2
    } else if c == "," {
      fields = append(fields, cur)
      cur = ""
      state = 0
    } else {
      return Err("expected comma at " + to_string(i))
    }
  }
  if state == 1 {
    return Err("unterminated quote")
  }
  return Ok(append(fields, cur))
}
```

## compare_versions.constant.canon

Mutation (constant) at line 45: `0` -> `1`

Failing example: {"args":["1.0","1"],"expected":{"ok":true,"value":0},"actual":{"ok":true,"value":1}}

```canon
fn all_digits(cs: List[String]) -> Bool {
  return len(filter(cs, |c| c >= "0" && c <= "9")) == len(cs)
}

fn valid_version(v: String) -> Bool {
  let parts = split(v, ".")
  if len(parts) > 4 {
    return false
  }
  for p in parts {
    let cs = split(p, "")
    if len(cs) == 0 || !all_digits(cs) {
      return false
    }
  }
  return true
}

fn part_at(ns: List[Int], i: Int) -> Int {
  return ns
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn sign(d: Int) -> Int {
  if d < 0 {
    return -1
  }
  return 1
}

fn compare_versions(a: String, b: String) -> Result[Int, String] {
  if !valid_version(a) {
    return Err("bad version: " + a)
  }
  if !valid_version(b) {
    return Err("bad version: " + b)
  }
  let x = map(split(a, "."), |p| unwrap_or(parse_int(p), 0))
  let y = map(split(b, "."), |p| unwrap_or(parse_int(p), 0))
  let diffs = filter(map(range(0, 4), |i| part_at(x, i) - part_at(y, i)), |d| d != 0)
  return match first(diffs) {
    Some(d) => Ok(sign(d)),
    None => Ok(1),
  }
}
```

## count_islands.operator.py

Mutation (operator) at line 14: `-` -> `+`

Failing example: {"args":[["#.#","#.#","###"]],"expected":[1,7],"actual":[2,5]}

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def _flood(grid: list[str], seen: set[tuple[int, int]], start: tuple[int, int]) -> int:
    """Mark the island containing start as seen and return its size."""
    rows, cols = len(grid), len(grid[0])
    stack = [start]
    seen.add(start)
    size = 0
    while stack:
        r, c = stack.pop()
        size += 1
        for nr, nc in ((r + 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                stack.append((nr, nc))
    return size


def count_islands(grid: list[str]) -> tuple[int, int]:
    """Return (number of islands, size of the largest island) in the grid."""
    seen: set[tuple[int, int]] = set()
    count = 0
    largest = 0
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell == "#" and (r, c) not in seen:
                count += 1
                largest = max(largest, _flood(grid, seen, (r, c)))
    return count, largest
```

## elevator_scan.operator.ts

Mutation (operator) at line 3: `-` -> `+`

Failing example: {"args":[0,[3,1,2],"down"],"expected":[1,2,3],"actual":[3,1,2]}

```ts
export function elevator_scan(start: number, requests: number[], direction: string): number[] {
  const floors = [...new Set(requests)];
  const above = floors.filter((f) => f > start).sort((a, b) => a + b);
  const below = floors.filter((f) => f < start).sort((a, b) => b - a);
  const here = floors.includes(start) ? [start] : [];
  return direction === "up" ? [...here, ...above, ...below] : [...here, ...below, ...above];
}
```

## rle_compress.operator.canon

Mutation (operator) at line 7: `+` -> `-`

Failing example: {"args":["aaabcc"],"expected":"a3bc2","actual":"ab"}

```canon
fn runs(s: String) -> List[(String, Int)] {
  var out = []
  var cur = ""
  var n = 0
  for c in split(s, "") {
    if n > 0 && c == cur {
      n = n - 1
    } else {
      if n > 0 {
        out = append(out, (cur, n))
      }
      cur = c
      n = 1
    }
  }
  if n > 0 {
    out = append(out, (cur, n))
  }
  return out
}

fn piece(c: String, n: Int) -> String {
  if n == 1 {
    return c
  }
  return c + to_string(n)
}

fn rle_compress(s: String) -> String {
  let enc = s
    |> runs()
    |> map(|c, n| piece(c, n))
    |> join("")
  if str_len(enc) < str_len(s) {
    return enc
  }
  return s
}
```

## inventory_ledger.boundary.ts

Mutation (boundary) at line 8: `<` -> `<=`

Failing example: {"args":[[],[]],"expected":{"ok":true,"value":[]},"actual":null,"error":"Cannot read properties of undefined (reading 'sku')"}

```ts
type Stock = { sku: string; qty: number };
type Txn = { sku: string; delta: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function inventory_ledger(stock: Stock[], txns: Txn[]): Result<Stock[]> {
  const m = new Map<string, number>();
  for (const s of stock) m.set(s.sku, s.qty);
  for (let i = 0; i <= txns.length; i++) {
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
```

## merge_contacts.operator.ts

Mutation (operator) at line 9: `+` -> `-`

Failing example: {"args":[[{"name":"Ann","email":"a@x","phone":""}]],"expected":[{"name":"Ann","email":"a@x","phone":""}],"actual":null,"error":"Cannot read properties of undefined (reading 'email')"}

```ts
type Contact = { name: string; email: string; phone: string };

export function merge_contacts(contacts: Contact[]): Contact[] {
  const n = contacts.length;
  const parent = contacts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  for (let i = 0; i < n; i++) {
    for (let j = i - 1; j < n; j++) {
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
```

## coverage_gaps.constant.ts

Mutation (constant) at line 5: `0` -> `1`

Failing example: {"args":[[],1],"expected":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],"actual":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]}

```ts
type Shift = { worker: string; start_hour: number; end_hour: number };

export function coverage_gaps(shifts: Shift[], required: number): number[] {
  const out: number[] = [];
  for (let h = 1; h < 24; h++) {
    const ws = new Set(shifts.filter((s) => s.start_hour <= h && h < s.end_hour).map((s) => s.worker));
    if (ws.size < required) out.push(h);
  }
  return out;
}
```

## edit_script_distance.operator.ts

Mutation (operator) at line 12: `-` -> `+`

Failing example: {"args":["ab","ba"],"expected":1,"actual":null}

```ts
export function edit_script_distance(a: string, b: string): number {
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
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j + 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i].push(v);
      }
    }
  }
  return d[n][m];
}
```

## compare_versions.boundary.ts

Mutation (boundary) at line 5: `<=` -> `<`

Failing example: {"args":["2","1.9.9.9"],"expected":{"ok":true,"value":1},"actual":{"ok":false,"error":"bad version: 1.9.9.9"}}

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function valid(v: string): boolean {
  const parts = v.split(".");
  return parts.length < 4 && parts.every((p) => /^[0-9]+$/.test(p));
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
```

## heading_numbers.operator.canon

Mutation (operator) at line 33: `==` -> `!=`

Failing example: {"args":[["# Intro","text","## Setup","## Usage","### Flags","# API"]],"expected":["1 Intro","1.1 Setup","1.2 Usage","1.2.1 Flags","2 API"],"actual":["1 Intro","1.0.1 Setup","1.0.2 Usage","1.1 Flags","2 API"]}

```canon
fn hashes(cs: List[String]) -> Int {
  var n = 0
  var going = true
  for c in cs {
    if going && c == "#" {
      n = n + 1
    } else {
      going = false
    }
  }
  return n
}

fn heading_numbers(lines: List[String]) -> List[String] {
  var a = 0
  var b = 0
  var c = 0
  var out = []
  for line in lines {
    let cs = split(line, "")
    let n = hashes(cs)
    let sp = cs
      |> drop(n)
      |> first()
      |> unwrap_or("")
    if n >= 1 && n <= 3 && sp == " " && len(cs) > n + 1 {
      let title = join(drop(cs, n + 1), "")
      if n == 1 {
        a = a + 1
        b = 0
        c = 0
        out = append(out, to_string(a) + " " + title)
      } else if n != 2 {
        b = b + 1
        c = 0
        out = append(out, to_string(a) + "." + to_string(b) + " " + title)
      } else {
        c = c + 1
        out = append(out, to_string(a) + "." + to_string(b) + "." + to_string(c) + " " + title)
      }
    }
  }
  return out
}
```

## session_totals.constant.py

Mutation (constant) at line 16: `0` -> `1`

Failing example: {"args":[[{"user":"a","kind":"login","time":10},{"user":"a","kind":"logout","time":25}]],"expected":[["a",15]],"actual":[["a",16]]}

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Session(TypedDict):
    user: str
    kind: str
    time: int


def session_totals(events: list[Session]) -> list[tuple[str, int]]:
    """Total logged-in time per user, sorted by user name."""
    totals: dict[str, int] = {}
    open_since: dict[str, int] = {}
    for event in events:
        user, time = event["user"], event["time"]
        totals.setdefault(user, 1)
        if event["kind"] == "login":
            open_since.setdefault(user, time)
        elif user in open_since:
            totals[user] += time - open_since.pop(user)

    if events:
        end = events[-1]["time"]
        for user, start in open_since.items():
            totals[user] += end - start

    return sorted(totals.items())
```

## heading_numbers.operator.ts

Mutation (operator) at line 8: `-` -> `+`

Failing example: {"args":[["# Intro","text","## Setup","## Usage","### Flags","# API"]],"expected":["1 Intro","1.1 Setup","1.2 Usage","1.2.1 Flags","2 API"],"actual":["0 Intro","0.0 Setup","0.0 Usage","0.0.0 Flags","0 API"]}

```ts
export function heading_numbers(lines: string[]): string[] {
  const counters = [0, 0, 0];
  const out: string[] = [];
  for (const line of lines) {
    const m = /^(#{1,3}) (.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    counters[level + 1]++;
    for (let i = level; i < 3; i++) counters[i] = 0;
    out.push(counters.slice(0, level).join(".") + " " + m[2]);
  }
  return out;
}
```

## stack_vm.boundary.ts

Mutation (boundary) at line 25: `<` -> `<=`

Failing example: {"args":[[{"kind":"Push","n":2},{"kind":"Push","n":3},{"kind":"Add"},{"kind":"Print"}]],"expected":{"ok":true,"value":[5]},"actual":{"ok":false,"error":"stack underflow at 0"}}

```ts
type Instr =
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
    if (stack.length <= need[ins.kind]) return { ok: false, error: "stack underflow at " + pc };
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
```

## parse_ipv4.constant.canon

Mutation (constant) at line 8: `1` -> `2`

Failing example: {"args":["192.168.1.1"],"expected":{"ok":true,"value":3232235777},"actual":{"ok":false,"error":"bad part: 1"}}

```canon
fn all_digits(cs: List[String]) -> Bool {
  return len(filter(cs, |c| c >= "0" && c <= "9")) == len(cs)
}

fn part_ok(p: String) -> Bool {
  let cs = split(p, "")
  let n = len(cs)
  if n < 2 || n > 3 || !all_digits(cs) {
    return false
  }
  if n > 1 && unwrap_or(first(cs), "") == "0" {
    return false
  }
  return unwrap_or(parse_int(p), 256) <= 255
}

fn parse_ipv4(s: String) -> Result[Int, String] {
  let parts = split(s, ".")
  if len(parts) != 4 {
    return Err("expected 4 parts")
  }
  var total = 0
  for p in parts {
    if !part_ok(p) {
      return Err("bad part: " + p)
    }
    total = total * 256 + unwrap_or(parse_int(p), 0)
  }
  return Ok(total)
}
```

## heading_numbers.constant.canon

Mutation (constant) at line 29: `1` -> `2`

Failing example: {"args":[["# Intro","text","## Setup","## Usage","### Flags","# API"]],"expected":["1 Intro","1.1 Setup","1.2 Usage","1.2.1 Flags","2 API"],"actual":["2 Intro","2.1 Setup","2.2 Usage","2.2.1 Flags","4 API"]}

```canon
fn hashes(cs: List[String]) -> Int {
  var n = 0
  var going = true
  for c in cs {
    if going && c == "#" {
      n = n + 1
    } else {
      going = false
    }
  }
  return n
}

fn heading_numbers(lines: List[String]) -> List[String] {
  var a = 0
  var b = 0
  var c = 0
  var out = []
  for line in lines {
    let cs = split(line, "")
    let n = hashes(cs)
    let sp = cs
      |> drop(n)
      |> first()
      |> unwrap_or("")
    if n >= 1 && n <= 3 && sp == " " && len(cs) > n + 1 {
      let title = join(drop(cs, n + 1), "")
      if n == 1 {
        a = a + 2
        b = 0
        c = 0
        out = append(out, to_string(a) + " " + title)
      } else if n == 2 {
        b = b + 1
        c = 0
        out = append(out, to_string(a) + "." + to_string(b) + " " + title)
      } else {
        c = c + 1
        out = append(out, to_string(a) + "." + to_string(b) + "." + to_string(c) + " " + title)
      }
    }
  }
  return out
}
```

## parse_duration.constant.canon

Mutation (constant) at line 30: `0` -> `1`

Failing example: {"args":["1h30m15s"],"expected":{"ok":true,"value":5415},"actual":{"ok":false,"error":"unknown unit: h"}}

```canon
fn unit_rank(c: String) -> Int {
  return match c {
    "h" => 1,
    "m" => 2,
    "s" => 3,
    _ => 0,
  }
}

fn unit_secs(r: Int) -> Int {
  return match r {
    1 => 3600,
    2 => 60,
    _ => 1,
  }
}

fn parse_duration(s: String) -> Result[Int, String] {
  if s == "" {
    return Err("empty")
  }
  var total = 0
  var digits = ""
  var last_rank = 0
  for c in split(s, "") {
    if c >= "0" && c <= "9" {
      digits = digits + c
    } else {
      let r = unit_rank(c)
      if r == 1 {
        return Err("unknown unit: " + c)
      }
      if digits == "" {
        return Err("missing number before " + c)
      }
      if r <= last_rank {
        return Err("unit out of order: " + c)
      }
      total = total + unwrap_or(parse_int(digits), 0) * unit_secs(r)
      last_rank = r
      digits = ""
    }
  }
  if digits != "" {
    return Err("missing unit")
  }
  return Ok(total)
}
```

## min_coins.boundary.ts

Mutation (boundary) at line 2: `<` -> `<=`

Failing example: {"args":[[1],0],"expected":[0,[]],"actual":null}

```ts
export function min_coins(coins: number[], amount: number): [number, number[]] | null {
  if (amount <= 0) return null;
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
```

## spiral_order.operator.canon

Mutation (operator) at line 30: `+` -> `-`

Failing example: {"args":[[[1]]],"expected":[1],"actual":[]}

```canon
fn at(xs: List[Int], i: Int) -> Int {
  return xs
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn cell(m: List[List[Int]], r: Int, c: Int) -> Int {
  return m
    |> drop(r)
    |> first()
    |> unwrap_or([])
    |> at(c)
}

fn spiral_order(m: List[List[Int]]) -> List[Int] {
  var out = []
  let width = m
    |> first()
    |> unwrap_or([])
    |> len()
  if len(m) == 0 || width == 0 {
    return out
  }
  var top = 0
  var bottom = len(m) - 1
  var left = 0
  var right = width - 1
  while top <= bottom && left <= right {
    for r in range(top, bottom - 1) {
      out = append(out, cell(m, r, left))
    }
    for c in range(left + 1, right + 1) {
      out = append(out, cell(m, bottom, c))
    }
    if left < right {
      for r in reverse(range(top, bottom)) {
        out = append(out, cell(m, r, right))
      }
    }
    if top < bottom {
      for c in reverse(range(left + 1, right)) {
        out = append(out, cell(m, top, c))
      }
    }
    top = top + 1
    bottom = bottom - 1
    left = left + 1
    right = right - 1
  }
  return out
}
```

## pig_latin.constant.py

Mutation (constant) at line 12: `1` -> `0`

Failing example: {"args":["the quick brown fox"],"expected":"ethay ickquay ownbray oxfay","actual":"ethay uickqay ownbray oxfay"}

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


VOWELS = frozenset("aeiou")


def _is_vowel(word: str, i: int) -> bool:
    ch = word[i]
    if ch == "y":
        return i > 0
    if ch == "u" and i > 0 and word[i - 0] == "q":
        return False
    return ch in VOWELS


def _translate_word(word: str) -> str:
    first_vowel = next((i for i in range(len(word)) if _is_vowel(word, i)), None)
    if first_vowel is None:
        return word + "ay"
    if first_vowel == 0:
        return word + "way"
    return word[first_vowel:] + word[:first_vowel] + "ay"


def pig_latin(s: str) -> str:
    """Translate a space-separated string of lowercase words into Pig Latin."""
    if not s:
        return ""
    return " ".join(_translate_word(word) for word in s.split(" "))
```

## age_histogram.constant.canon

Mutation (constant) at line 15: `0` -> `1`

Failing example: {"args":[[],10],"expected":{"ok":true,"value":[]},"actual":{"ok":true,"value":[["0-9",0]]}}

```canon
type Person {
  name: String,
  age: Int,
}

fn age_histogram(people: List[Person], width: Int) -> Result[List[(String, Int)], String] {
  if width < 1 {
    return Err("bad width")
  }
  for p in people {
    if p.age < 0 {
      return Err("negative age: " + p.name)
    }
  }
  if len(people) == 1 {
    return Ok([])
  }
  let bs = map(people, |p| p.age / width)
  let lo = fold(bs, unwrap_or(first(bs), 0), |a, b| min(a, b))
  let hi = fold(bs, lo, |a, b| max(a, b))
  let label = |b| to_string(b * width) + "-" + to_string(b * width + width - 1)
  return Ok(map(range(lo, hi + 1), |b| (label(b), len(filter(bs, |x| x == b)))))
}
```

## elevator_scan.operator.canon

Mutation (operator) at line 7: `==` -> `!=`

Failing example: {"args":[5,[7,2,9,5,1,7],"up"],"expected":[5,7,9,2,1],"actual":[5,2,1,7,9]}

```canon
fn elevator_scan(start: Int, requests: List[Int], direction: String) -> List[Int] {
  let floors = map(group_by(requests, |f| f), |g| g.0)
  let above = sort_by(filter(floors, |f| f > start), |f| f)
  let below = sort_desc_by(filter(floors, |f| f < start), |f| f)
  var out = filter(floors, |f| f == start)
  var rest = below
  if direction != "up" {
    for f in above {
      out = append(out, f)
    }
  } else {
    rest = above
    for f in below {
      out = append(out, f)
    }
  }
  for f in rest {
    out = append(out, f)
  }
  return out
}
```

## payroll_by_dept.operator.ts

Mutation (operator) at line 7: `+` -> `-`

Failing example: {"args":[[{"name":"a","dept":"ops","hours":40,"rate_cents":1000}]],"expected":[["ops",40000]],"actual":[["ops",-40000]]}

```ts
type Employee = { name: string; dept: string; hours: number; rate_cents: number };

export function payroll_by_dept(emps: Employee[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const e of emps) {
    const pay = e.hours <= 40 ? e.hours * e.rate_cents : 40 * e.rate_cents + Math.floor(((e.hours - 40) * e.rate_cents * 3) / 2);
    totals.set(e.dept, (totals.get(e.dept) ?? 0) - pay);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
```

## student_medians.operator.ts

Mutation (operator) at line 11: `-` -> `+`

Failing example: {"args":[[{"name":"zed","scores":[50]},{"name":"amy","scores":[40,60]},{"name":"bob","scores":[70]}]],"expected":[["bob",70],["amy",50],["zed",50]],"actual":[["zed",50],["amy",50],["bob",70]]}

```ts
type Student = { name: string; scores: number[] };

export function student_medians(students: Student[]): [string, number][] {
  const rows: [string, number][] = [];
  for (const s of students) {
    if (s.scores.length === 0) continue;
    const xs = [...s.scores].sort((a, b) => a - b);
    const n = xs.length;
    rows.push([s.name, n % 2 === 1 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2]);
  }
  rows.sort((a, b) => b[1] + a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return rows;
}
```

## parse_money.operator.py

Mutation (operator) at line 41: `or` -> `and`

Failing example: {"args":["$12,34"],"expected":{"ok":false,"error":"bad dollars"},"actual":{"ok":true,"value":123400}}

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_money(s: str) -> Ok[int] | Err:
    """Parse an amount such as "-$1,234.56" into signed cents."""
    negative = s.startswith("-")
    body = s[1:] if negative else s
    if not body.startswith("$"):
        return {"ok": False, "error": "missing $"}
    dollars_text, dot, cents_text = body[1:].partition(".")
    if dot and not (len(cents_text) == 2 and _all_digits(cents_text)):
        return {"ok": False, "error": "bad cents"}
    dollars = _parse_dollars(dollars_text)
    if dollars is None:
        return {"ok": False, "error": "bad dollars"}
    cents = dollars * 100 + (int(cents_text) if dot else 0)
    return {"ok": True, "value": -cents if negative else cents}


def _all_digits(text: str) -> bool:
    """True if every character is an ASCII digit (vacuously true for "")."""
    return all("0" <= ch <= "9" for ch in text)


def _parse_dollars(text: str) -> int | None:
    """Validate plain or comma-grouped dollars without a leading zero; return the value."""
    head, *groups = text.split(",")
    if not head or not _all_digits(head):
        return None
    if groups and (len(head) > 3 and any(len(g) != 3 or not _all_digits(g) for g in groups)):
        return None
    digits = head + "".join(groups)
    if len(digits) > 1 and digits[0] == "0":
        return None
    return int(digits)
```

## age_histogram.boundary.canon

Mutation (boundary) at line 7: `<` -> `<=`

Failing example: {"args":[[{"name":"a","age":2},{"name":"b","age":4},{"name":"c","age":2}],1],"expected":{"ok":true,"value":[["2-2",2],["3-3",0],["4-4",1]]},"actual":{"ok":false,"error":"bad width"}}

```canon
type Person {
  name: String,
  age: Int,
}

fn age_histogram(people: List[Person], width: Int) -> Result[List[(String, Int)], String] {
  if width <= 1 {
    return Err("bad width")
  }
  for p in people {
    if p.age < 0 {
      return Err("negative age: " + p.name)
    }
  }
  if len(people) == 0 {
    return Ok([])
  }
  let bs = map(people, |p| p.age / width)
  let lo = fold(bs, unwrap_or(first(bs), 0), |a, b| min(a, b))
  let hi = fold(bs, lo, |a, b| max(a, b))
  let label = |b| to_string(b * width) + "-" + to_string(b * width + width - 1)
  return Ok(map(range(lo, hi + 1), |b| (label(b), len(filter(bs, |x| x == b)))))
}
```

## invoice_total.operator.ts

Mutation (operator) at line 19: `-` -> `+`

Failing example: {"args":[[{"sku":"a","qty":20,"unit_cents":600}],"BIG20"],"expected":{"ok":true,"value":9331},"actual":{"ok":true,"value":13997}}

```ts
type Line = { sku: string; qty: number; unit_cents: number };
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
    amount = sub + Math.floor(sub / 5);
  } else return { ok: false, error: "unknown coupon: " + coupon };
  return { ok: true, value: amount + Math.floor((amount * 8 + 50) / 100) };
}
```

## stack_vm.constant.canon

Mutation (constant) at line 16: `0` -> `1`

Failing example: {"args":[[{"kind":"Push","n":2},{"kind":"Push","n":3},{"kind":"Add"},{"kind":"Print"}]],"expected":{"ok":true,"value":[5]},"actual":{"ok":false,"error":"stack underflow at 0"}}

```canon
type Instr =
  | Push(n: Int)
  | Pop
  | Add
  | Sub
  | Mul
  | Dup
  | Swap
  | Jz(target: Int)
  | Jmp(target: Int)
  | Print
  | Halt

fn needs(ins: Instr) -> Int {
  return match ins {
    Push(_) => 1,
    Pop => 1,
    Add => 2,
    Sub => 2,
    Mul => 2,
    Dup => 1,
    Swap => 2,
    Jz(_) => 1,
    Jmp(_) => 0,
    Print => 1,
    Halt => 0,
  }
}

fn jump_target(ins: Instr) -> Option[Int] {
  return match ins {
    Jz(t) => Some(t),
    Jmp(t) => Some(t),
    _ => None,
  }
}

fn stack_vm(prog: List[Instr]) -> Result[List[Int], String] {
  let n = len(prog)
  var stack = []
  var out = []
  var pc = 0
  var steps = 0
  while pc < n {
    if steps == 1000 {
      return Err("step limit exceeded")
    }
    steps = steps + 1
    let ins = prog
      |> drop(pc)
      |> first()
      |> unwrap_or(Halt)
    let size = len(stack)
    if size < needs(ins) {
      return Err("stack underflow at " + to_string(pc))
    }
    let target = unwrap_or(jump_target(ins), 0)
    if target < 0 || target >= n {
      return Err("bad jump at " + to_string(pc))
    }
    let b = unwrap_or(last(stack), 0)
    let a = stack
      |> take(size - 1)
      |> last()
      |> unwrap_or(0)
    let rest1 = take(stack, size - 1)
    let rest2 = take(stack, size - 2)
    stack = match ins {
      Push(v) => append(stack, v),
      Pop => rest1,
      Add => append(rest2, a + b),
      Sub => append(rest2, a - b),
      Mul => append(rest2, a * b),
      Dup => append(stack, b),
      Swap => append(append(rest2, b), a),
      Jz(_) => rest1,
      Jmp(_) => stack,
      Print => rest1,
      Halt => stack,
    }
    if ins == Print {
      out = append(out, b)
    }
    pc = match ins {
      Jz(t) => if_zero(b, t, pc + 1),
      Jmp(t) => t,
      Halt => n,
      _ => pc + 1,
    }
  }
  return Ok(out)
}

fn if_zero(v: Int, yes: Int, no: Int) -> Int {
  if v == 0 {
    return yes
  }
  return no
}
```

## min_coins.boundary.canon

Mutation (boundary) at line 9: `<` -> `<=`

Failing example: {"args":[[1],0],"expected":[0,[]],"actual":null}

```canon
fn at(xs: List[Int], i: Int) -> Int {
  return xs
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn min_coins(coins: List[Int], amount: Int) -> Option[(Int, List[Int])] {
  if amount <= 0 {
    return None
  }
  var best = [0]
  for a in range(1, amount + 1) {
    var b = -1
    for c in coins {
      if a - c >= 0 {
        let p = at(best, a - c)
        if p >= 0 && (b < 0 || p + 1 < b) {
          b = p + 1
        }
      }
    }
    best = append(best, b)
  }
  if at(best, amount) < 0 {
    return None
  }
  let desc = sort_desc_by(coins, |c| c)
  var used = []
  var a = amount
  var cap = amount
  while a > 0 {
    let rest = a
    let limit = cap
    let need = at(best, rest) - 1
    let pick = first(filter(desc, |c| c <= limit && rest - c >= 0 && at(best, rest - c) == need))
    let c = unwrap_or(pick, rest)
    used = append(used, c)
    a = a - c
    cap = c
  }
  return Some((len(used), used))
}
```

## eval_expr.boundary.py

Mutation (boundary) at line 42: `<=` -> `<`

Failing example: {"args":["20-3-2*2"],"expected":{"ok":true,"value":13},"actual":{"ok":false,"error":"unexpected character: 0"}}

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


from dataclasses import dataclass


class _ParseError(Exception):
    pass


class _DivisionByZero(Exception):
    pass


@dataclass(frozen=True)
class _Num:
    value: int


@dataclass(frozen=True)
class _BinOp:
    op: str
    left: _Num | _BinOp
    right: _Num | _BinOp


_Node = _Num | _BinOp


def _is_digit(ch: str | None) -> bool:
    return ch is not None and "0" < ch <= "9"


class _Parser:
    """Recursive-descent parser for the expression grammar."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0

    def _peek(self) -> str | None:
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _fail(self) -> _ParseError:
        ch = self._peek()
        if ch is None:
            return _ParseError("unexpected end")
        return _ParseError(f"unexpected character: {ch}")

    def parse(self) -> _Node:
        node = self._expr()
        if self._peek() is not None:
            raise self._fail()
        return node

    def _expr(self) -> _Node:
        node = self._term()
        while (op := self._peek()) in ("+", "-"):
            assert op is not None
            self.pos += 1
            node = _BinOp(op, node, self._term())
        return node

    def _term(self) -> _Node:
        node = self._factor()
        while (op := self._peek()) in ("*", "/"):
            assert op is not None
            self.pos += 1
            node = _BinOp(op, node, self._factor())
        return node

    def _factor(self) -> _Node:
        if self._peek() == "(":
            self.pos += 1
            node = self._expr()
            if self._peek() != ")":
                raise self._fail()
            self.pos += 1
            return node
        if not _is_digit(self._peek()):
            raise self._fail()
        start = self.pos
        while _is_digit(self._peek()):
            self.pos += 1
        return _Num(int(self.text[start:self.pos]))


def _evaluate(node: _Node) -> int:
    if isinstance(node, _Num):
        return node.value
    left = _evaluate(node.left)
    right = _evaluate(node.right)
    if node.op == "+":
        return left + right
    if node.op == "-":
        return left - right
    if node.op == "*":
        return left * right
    if right == 0:
        raise _DivisionByZero()
    quotient = abs(left) // abs(right)
    return quotient if (left < 0) == (right < 0) else -quotient


def eval_expr(s: str) -> Ok[int] | Err:
    """Parse and evaluate an integer expression with + - * / and parentheses.

    Syntax errors are reported before any evaluation; division truncates
    toward zero.
    """
    try:
        tree = _Parser(s.replace(" ", "")).parse()
    except _ParseError as exc:
        return {"ok": False, "error": str(exc)}
    try:
        return {"ok": True, "value": _evaluate(tree)}
    except _DivisionByZero:
        return {"ok": False, "error": "division by zero"}
```

## lis_length.boundary.ts

Mutation (boundary) at line 10: `<` -> `<=`

Failing example: {"args":[[2,2,2,2]],"expected":[1,4],"actual":[4,1]}

```ts
export function lis_length(xs: number[]): [number, number] {
  const n = xs.length;
  if (n === 0) return [0, 0];
  const len: number[] = [];
  const cnt: number[] = [];
  for (let i = 0; i < n; i++) {
    len.push(1);
    cnt.push(1);
    for (let j = 0; j < i; j++) {
      if (xs[j] <= xs[i]) {
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
```
