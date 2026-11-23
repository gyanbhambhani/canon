# Spot check: seeds, hidden tests and the three references (10% of 60 seeds)

Check: the spec is unambiguous, the tests match it, and each reference is idiomatic for its language.

## inventory_ledger

stock gives the starting quantity of each sku; skus in stock are distinct and quantities are at least 0. Apply the transactions in order, adding delta to the sku's quantity. If a transaction's sku is not in stock (whatever its delta), return the error "txn N: unknown sku S"; if it would make the quantity negative, return the error "txn N: S would go negative", where N is the 1-based position of the transaction and S its sku. Transactions never add new skus. Otherwise return the final Stock entries for the skus whose final quantity is greater than 0, ordered by sku in ascending code-point order.

Hidden tests:

```json
{"args":[[],[]],"expected":{"ok":true,"value":[]}}
{"args":[[{"sku":"b","qty":5},{"sku":"a","qty":2}],[]],"expected":{"ok":true,"value":[{"sku":"a","qty":2},{"sku":"b","qty":5}]}}
{"args":[[{"sku":"a","qty":5}],[{"sku":"a","delta":-5}]],"expected":{"ok":true,"value":[]}}
{"args":[[{"sku":"a","qty":1}],[{"sku":"a","delta":-2}]],"expected":{"ok":false,"error":"txn 1: a would go negative"}}
{"args":[[{"sku":"a","qty":1},{"sku":"b","qty":0}],[{"sku":"a","delta":3},{"sku":"c","delta":1}]],"expected":{"ok":false,"error":"txn 2: unknown sku c"}}
{"args":[[{"sku":"w","qty":0}],[{"sku":"w","delta":4},{"sku":"w","delta":-4},{"sku":"w","delta":1}]],"expected":{"ok":true,"value":[{"sku":"w","qty":1}]}}
{"args":[[{"sku":"p","qty":3},{"sku":"q","qty":1}],[{"sku":"p","delta":-1},{"sku":"q","delta":-1},{"sku":"p","delta":-3}]],"expected":{"ok":false,"error":"txn 3: p would go negative"}}
{"args":[[{"sku":"z","qty":0},{"sku":"m","qty":7}],[{"sku":"m","delta":-2}]],"expected":{"ok":true,"value":[{"sku":"m","qty":5}]}}
{"args":[[{"sku":"a","qty":1}],[{"sku":"b","delta":0}]],"expected":{"ok":false,"error":"txn 1: unknown sku b"}}
```

### canon

```canon
type Stock {
  sku: String,
  qty: Int,
}

type Txn {
  sku: String,
  delta: Int,
}

fn update(s: Stock, sku: String, delta: Int) -> Stock {
  if s.sku == sku {
    return Stock { sku: s.sku, qty: s.qty + delta }
  }
  return s
}

fn inventory_ledger(stock: List[Stock], txns: List[Txn]) -> Result[List[Stock], String] {
  var cur = stock
  for p in enumerate(txns) {
    let n = to_string(p.0 + 1)
    let t = p.1
    let hit = filter(cur, |s| s.sku == t.sku)
    if len(hit) == 0 {
      return Err("txn " + n + ": unknown sku " + t.sku)
    }
    let q = sum(map(hit, |s| s.qty)) + t.delta
    if q < 0 {
      return Err("txn " + n + ": " + t.sku + " would go negative")
    }
    cur = map(cur, |s| update(s, t.sku, t.delta))
  }
  let out = sort_by(filter(cur, |s| s.qty > 0), |s| s.sku)
  return Ok(out)
}
```

### py

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

class Stock(TypedDict):
    sku: str
    qty: int

class Txn(TypedDict):
    sku: str
    delta: int


def inventory_ledger(stock: list[Stock], txns: list[Txn]) -> Ok[list[Stock]] | Err:
    """Apply stock transactions in order; report the first unknown sku or negative balance."""
    quantities: dict[str, int] = {item["sku"]: item["qty"] for item in stock}
    for position, txn in enumerate(txns, start=1):
        sku = txn["sku"]
        if sku not in quantities:
            return {"ok": False, "error": f"txn {position}: unknown sku {sku}"}
        updated = quantities[sku] + txn["delta"]
        if updated < 0:
            return {"ok": False, "error": f"txn {position}: {sku} would go negative"}
        quantities[sku] = updated
    remaining: list[Stock] = [
        {"sku": sku, "qty": qty} for sku, qty in sorted(quantities.items()) if qty > 0
    ]
    return {"ok": True, "value": remaining}
```

### ts

```ts
type Stock = { sku: string; qty: number };
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
```

## tokenize

Split s into tokens, scanning left to right. A space character separates tokens and produces nothing. A maximal run of decimal digits is a Num whose value is that number (leading zeros allowed). An identifier starts with a lowercase letter a-z or "_" and continues with as many lowercase letters, digits and "_" as possible; it is an Ident. Symbols are Sym tokens: first try the two-character symbols "==", "<=", ">=" and "!=", then the one-character symbols + - * / = < > ( ) and ",". A digit run stops at the first non-digit, so "12ab" is Num 12 then Ident "ab". Any other character (including uppercase letters, tabs and a lone "!") gives the error "unexpected character: C at N", where C is the character and N its 0-based position in s.

Hidden tests:

```json
{"args":["x = 42"],"expected":{"ok":true,"value":[{"kind":"Ident","name":"x"},{"kind":"Sym","text":"="},{"kind":"Num","value":42}]}}
{"args":[""],"expected":{"ok":true,"value":[]}}
{"args":["a<=b!=c"],"expected":{"ok":true,"value":[{"kind":"Ident","name":"a"},{"kind":"Sym","text":"<="},{"kind":"Ident","name":"b"},{"kind":"Sym","text":"!="},{"kind":"Ident","name":"c"}]}}
{"args":["12ab"],"expected":{"ok":true,"value":[{"kind":"Num","value":12},{"kind":"Ident","name":"ab"}]}}
{"args":["f(x_1, 007)"],"expected":{"ok":true,"value":[{"kind":"Ident","name":"f"},{"kind":"Sym","text":"("},{"kind":"Ident","name":"x_1"},{"kind":"Sym","text":","},{"kind":"Num","value":7},{"kind":"Sym","text":")"}]}}
{"args":["<<==>"],"expected":{"ok":true,"value":[{"kind":"Sym","text":"<"},{"kind":"Sym","text":"<="},{"kind":"Sym","text":"="},{"kind":"Sym","text":">"}]}}
{"args":["_ 9"],"expected":{"ok":true,"value":[{"kind":"Ident","name":"_"},{"kind":"Num","value":9}]}}
{"args":["a ! b"],"expected":{"ok":false,"error":"unexpected character: ! at 2"}}
{"args":["count = Max"],"expected":{"ok":false,"error":"unexpected character: M at 8"}}
{"args":["x;1"],"expected":{"ok":false,"error":"unexpected character: ; at 1"}}
```

### canon

```canon
type Token =
  | Num(value: Int)
  | Ident(name: String)
  | Sym(text: String)

fn at(cs: List[String], i: Int) -> String {
  return cs
    |> drop(i)
    |> first()
    |> unwrap_or("")
}

fn is_digit(c: String) -> Bool {
  return str_len(c) == 1 && c >= "0" && c <= "9"
}

fn is_start(c: String) -> Bool {
  return str_len(c) == 1 && (c >= "a" && c <= "z" || c == "_")
}

fn tokenize(s: String) -> Result[List[Token], String] {
  let cs = split(s, "")
  let n = len(cs)
  var i = 0
  var out = []
  while i < n {
    let c = at(cs, i)
    let two = c + at(cs, i + 1)
    if c == " " {
      i = i + 1
    } else if is_digit(c) {
      var v = 0
      while is_digit(at(cs, i)) {
        v = v * 10 + (cs |> at(i) |> parse_int() |> unwrap_or(0))
        i = i + 1
      }
      out = append(out, Num(v))
    } else if is_start(c) {
      var name = ""
      while is_start(at(cs, i)) || is_digit(at(cs, i)) {
        name = name + at(cs, i)
        i = i + 1
      }
      out = append(out, Ident(name))
    } else if contains(["==", "<=", ">=", "!="], two) {
      out = append(out, Sym(two))
      i = i + 2
    } else if contains(["+", "-", "*", "/", "=", "<", ">", "(", ")", ","], c) {
      out = append(out, Sym(c))
      i = i + 1
    } else {
      return Err("unexpected character: " + c + " at " + to_string(i))
    }
  }
  return Ok(out)
}
```

### py

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

class Num(TypedDict):
    kind: Literal["Num"]
    value: int

class Ident(TypedDict):
    kind: Literal["Ident"]
    name: str

class Sym(TypedDict):
    kind: Literal["Sym"]
    text: str

Token = Num | Ident | Sym


TWO_CHAR_SYMBOLS = frozenset({"==", "<=", ">=", "!="})
ONE_CHAR_SYMBOLS = frozenset("+-*/=<>(),")


def _is_digit(ch: str) -> bool:
    return "0" <= ch <= "9"


def _is_ident_start(ch: str) -> bool:
    return "a" <= ch <= "z" or ch == "_"


def _is_ident_char(ch: str) -> bool:
    return _is_ident_start(ch) or _is_digit(ch)


def _scan_while(s: str, start: int, pred: Callable[[str], bool]) -> int:
    end = start
    while end < len(s) and pred(s[end]):
        end += 1
    return end


def tokenize(s: str) -> Ok[list[Token]] | Err:
    """Split s into number, identifier and symbol tokens."""
    tokens: list[Token] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == " ":
            i += 1
        elif _is_digit(ch):
            end = _scan_while(s, i, _is_digit)
            tokens.append({"kind": "Num", "value": int(s[i:end])})
            i = end
        elif _is_ident_start(ch):
            end = _scan_while(s, i, _is_ident_char)
            tokens.append({"kind": "Ident", "name": s[i:end]})
            i = end
        elif s[i : i + 2] in TWO_CHAR_SYMBOLS:
            tokens.append({"kind": "Sym", "text": s[i : i + 2]})
            i += 2
        elif ch in ONE_CHAR_SYMBOLS:
            tokens.append({"kind": "Sym", "text": ch})
            i += 1
        else:
            return {"ok": False, "error": f"unexpected character: {ch} at {i}"}
    return {"ok": True, "value": tokens}
```

### ts

```ts
type Token =
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
```

## wrap_text

Words in s are separated by one or more spaces; leading and trailing spaces are ignored. width >= 1. Wrap the words into lines greedily: words on a line are separated by single spaces, and the next word is added to the current line if the line's length afterwards is at most width; otherwise that word starts a new line. A word longer than width is never split: it goes on its own line (the line before it ends, and the next word starts a new line). Return the lines in order; if s has no words, return an empty list.

Hidden tests:

```json
{"args":["the quick brown fox",10],"expected":["the quick","brown fox"]}
{"args":["  a  b   c ",3],"expected":["a b","c"]}
{"args":["",5],"expected":[]}
{"args":["    ",4],"expected":[]}
{"args":["hello",5],"expected":["hello"]}
{"args":["a verylongword b",4],"expected":["a","verylongword","b"]}
{"args":["aa bb cc dd",5],"expected":["aa bb","cc dd"]}
{"args":["one two",1],"expected":["one","two"]}
```

### canon

```canon
fn wrap_text(s: String, width: Int) -> List[String] {
  let words = filter(split(s, " "), |w| w != "")
  var lines = []
  var cur = ""
  for w in words {
    if cur == "" {
      cur = w
    } else if str_len(cur) + 1 + str_len(w) <= width {
      cur = cur + " " + w
    } else {
      lines = append(lines, cur)
      cur = w
    }
  }
  if cur != "" {
    lines = append(lines, cur)
  }
  return lines
}
```

### py

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def wrap_text(s: str, width: int) -> list[str]:
    """Greedily wrap the space-separated words of s into lines of at most width."""
    lines: list[str] = []
    current = ""
    for word in s.split(" "):
        if not word:
            continue
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= width:
            current = f"{current} {word}"
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines
```

### ts

```ts
export function wrap_text(s: string, width: number): string[] {
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
```

## next_permutation

Return the next arrangement of xs in lexicographic order among all distinct arrangements of its elements (xs may contain repeated values). If xs is already the last arrangement (non-increasing order), return its elements in ascending order instead. Empty and one-element lists are returned unchanged.

Hidden tests:

```json
{"args":[[1,2,3]],"expected":[1,3,2]}
{"args":[[3,2,1]],"expected":[1,2,3]}
{"args":[[1,1,5]],"expected":[1,5,1]}
{"args":[[1,5,1]],"expected":[5,1,1]}
{"args":[[5,1,1]],"expected":[1,1,5]}
{"args":[[]],"expected":[]}
{"args":[[7]],"expected":[7]}
{"args":[[2,3,1,3,3]],"expected":[2,3,3,1,3]}
{"args":[[1,3,2]],"expected":[2,1,3]}
```

### canon

```canon
fn choose(cond: Bool, a: Int, b: Int) -> Int {
  if cond {
    return a
  }
  return b
}

fn at(xs: List[Int], i: Int) -> Int {
  return xs
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn next_permutation(xs: List[Int]) -> List[Int] {
  var pivot_at = -1
  for p in enumerate(zip(xs, drop(xs, 1))) {
    let pair = p.1
    if pair.0 < pair.1 {
      pivot_at = p.0
    }
  }
  if pivot_at < 0 {
    return sort_by(xs, |x| x)
  }
  let pivot = at(xs, pivot_at)
  let suffix = drop(xs, pivot_at + 1)
  var j = 0
  for q in enumerate(suffix) {
    if q.1 > pivot {
      j = q.0
    }
  }
  let swapped = map(enumerate(suffix), |q| choose(q.0 == j, pivot, q.1))
  var out = append(take(xs, pivot_at), at(suffix, j))
  for x in reverse(swapped) {
    out = append(out, x)
  }
  return out
}
```

### py

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def next_permutation(xs: list[int]) -> list[int]:
    """Return the next distinct lexicographic arrangement of xs, wrapping to ascending order."""
    result = list(xs)
    pivot = len(result) - 2
    while pivot >= 0 and result[pivot] >= result[pivot + 1]:
        pivot -= 1
    if pivot >= 0:
        successor = len(result) - 1
        while result[successor] <= result[pivot]:
            successor -= 1
        result[pivot], result[successor] = result[successor], result[pivot]
    # The suffix after the pivot is non-increasing; reversing makes it the smallest arrangement.
    result[pivot + 1 :] = reversed(result[pivot + 1 :])
    return result
```

### ts

```ts
export function next_permutation(xs: number[]): number[] {
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
```

## payroll_by_dept

Compute each employee's pay in cents: the first 40 hours are paid at rate_cents per hour; every hour above 40 is overtime, paid at 1.5 times the rate. For an employee with more than 40 hours, overtime pay is (hours - 40) * rate_cents * 3 / 2 rounded down to a whole cent, computed separately for each employee before any summing. Return one (dept, total pay) pair per department that has at least one employee, ordered by total pay (highest first), then by department name in ascending code-point order.

Hidden tests:

```json
{"args":[[]],"expected":[]}
{"args":[[{"name":"a","dept":"ops","hours":40,"rate_cents":1000}]],"expected":[["ops",40000]]}
{"args":[[{"name":"a","dept":"eng","hours":41,"rate_cents":1001}]],"expected":[["eng",41541]]}
{"args":[[{"name":"b","dept":"y","hours":5,"rate_cents":200},{"name":"a","dept":"x","hours":10,"rate_cents":100},{"name":"c","dept":"x","hours":0,"rate_cents":500}]],"expected":[["x",1000],["y",1000]]}
{"args":[[{"name":"a","dept":"d","hours":41,"rate_cents":1},{"name":"b","dept":"d","hours":41,"rate_cents":1}]],"expected":[["d",82]]}
{"args":[[{"name":"a","dept":"s","hours":45,"rate_cents":2000},{"name":"b","dept":"t","hours":50,"rate_cents":1000},{"name":"c","dept":"s","hours":20,"rate_cents":1500}]],"expected":[["s",125000],["t",55000]]}
{"args":[[{"name":"z","dept":"q","hours":43,"rate_cents":333}]],"expected":[["q",14818]]}
{"args":[[{"name":"a","dept":"m","hours":39,"rate_cents":10},{"name":"b","dept":"n","hours":0,"rate_cents":99}]],"expected":[["m",390],["n",0]]}
```

### canon

```canon
type Employee {
  name: String,
  dept: String,
  hours: Int,
  rate_cents: Int,
}

fn pay(e: Employee) -> Int {
  if e.hours <= 40 {
    return e.hours * e.rate_cents
  }
  return 40 * e.rate_cents + (e.hours - 40) * e.rate_cents * 3 / 2
}

fn payroll_by_dept(emps: List[Employee]) -> List[(String, Int)] {
  return emps
    |> group_by(|e| e.dept)
    |> map(|g| (g.0, sum(map(g.1, |e| pay(e)))))
    |> sort_by(|r| r.0)
    |> sort_desc_by(|r| r.1)
}
```

### py

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Employee(TypedDict):
    name: str
    dept: str
    hours: int
    rate_cents: int


REGULAR_HOURS = 40


def employee_pay(emp: Employee) -> int:
    """Pay in cents for one employee, with overtime at 1.5x rounded down."""
    rate = emp["rate_cents"]
    hours = emp["hours"]
    regular = min(hours, REGULAR_HOURS)
    overtime = max(hours - REGULAR_HOURS, 0)
    return regular * rate + overtime * rate * 3 // 2


def payroll_by_dept(emps: list[Employee]) -> list[tuple[str, int]]:
    """Total pay per department, highest total first, ties by department name."""
    totals: dict[str, int] = {}
    for emp in emps:
        totals[emp["dept"]] = totals.get(emp["dept"], 0) + employee_pay(emp)
    return sorted(totals.items(), key=lambda item: (-item[1], item[0]))
```

### ts

```ts
type Employee = { name: string; dept: string; hours: number; rate_cents: number };

export function payroll_by_dept(emps: Employee[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const e of emps) {
    const pay = e.hours <= 40 ? e.hours * e.rate_cents : 40 * e.rate_cents + Math.floor(((e.hours - 40) * e.rate_cents * 3) / 2);
    totals.set(e.dept, (totals.get(e.dept) ?? 0) + pay);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
```

## bracket_depth

Check the brackets ( ) [ ] { } in s; every other character is ignored. Each closing bracket must match the most recent unclosed opening bracket of the same kind. Return the maximum nesting depth (0 if there are no brackets; "([])" has depth 2). Scanning left to right, if a closing bracket does not match (or nothing is open), return the error "mismatch at N", where N is its 0-based position in s. If the scan finishes with brackets still open, return the error "unclosed at end".

Hidden tests:

```json
{"args":[""],"expected":{"ok":true,"value":0}}
{"args":["abc"],"expected":{"ok":true,"value":0}}
{"args":["a(b[c]{d})"],"expected":{"ok":true,"value":2}}
{"args":["([{}])"],"expected":{"ok":true,"value":3}}
{"args":["{[()()]}()"],"expected":{"ok":true,"value":3}}
{"args":["(]"],"expected":{"ok":false,"error":"mismatch at 1"}}
{"args":["())"],"expected":{"ok":false,"error":"mismatch at 2"}}
{"args":["(("],"expected":{"ok":false,"error":"unclosed at end"}}
{"args":["x)("],"expected":{"ok":false,"error":"mismatch at 1"}}
{"args":["(()"],"expected":{"ok":false,"error":"unclosed at end"}}
```

### canon

```canon
fn closer(c: String) -> String {
  return match c {
    "(" => ")",
    "[" => "]",
    "{" => "}",
    _ => "",
  }
}

fn bracket_depth(s: String) -> Result[Int, String] {
  var stack = []
  var best = 0
  for p in enumerate(split(s, "")) {
    let c = p.1
    if closer(c) != "" {
      stack = append(stack, closer(c))
      best = max(best, len(stack))
    } else if c == ")" || c == "]" || c == "}" {
      if unwrap_or(last(stack), "") != c {
        return Err("mismatch at " + to_string(p.0))
      }
      stack = take(stack, len(stack) - 1)
    }
  }
  if len(stack) > 0 {
    return Err("unclosed at end")
  }
  return Ok(best)
}
```

### py

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


_PAIRS: dict[str, str] = {")": "(", "]": "[", "}": "{"}
_OPENERS = frozenset(_PAIRS.values())


def bracket_depth(s: str) -> Ok[int] | Err:
    """Return the maximum bracket nesting depth of s, or a matching error."""
    stack: list[str] = []
    deepest = 0
    for i, ch in enumerate(s):
        if ch in _OPENERS:
            stack.append(ch)
            deepest = max(deepest, len(stack))
        elif ch in _PAIRS:
            if not stack or stack[-1] != _PAIRS[ch]:
                return {"ok": False, "error": f"mismatch at {i}"}
            stack.pop()
    if stack:
        return {"ok": False, "error": "unclosed at end"}
    return {"ok": True, "value": deepest}
```

### ts

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

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
```
