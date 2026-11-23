# Spot check: CHANGE items (10%)

Check: the requirement is clear, the new and regression tests match it, and the three updated references are natural edits.

## bank_ledger

Requirement: Add a new operation, Close(name), which removes an account. Its checks, in order: an account that does not exist gives "unknown account NAME"; an account whose balance is not 0 gives "account NAME not empty". A closed account no longer exists: later operations on it fail with "unknown account NAME", it is left out of the result, and it may be opened again with Open (as a new account with balance 0, placed in the result by its new opening).

```json
{
 "id": "bank_ledger",
 "cases": [
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "b"
     },
     {
      "kind": "Close",
      "name": "a"
     }
    ]
   ],
   "expected": {
    "ok": true,
    "value": [
     [
      "b",
      0
     ]
    ]
   }
  },
  {
   "args": [
    [
     {
      "kind": "Close",
      "name": "a"
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 1: unknown account a"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 5
     },
     {
      "kind": "Close",
      "name": "a"
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 3: account a not empty"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 5
     },
     {
      "kind": "Withdraw",
      "name": "a",
      "amount": 5
     },
     {
      "kind": "Close",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 1
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 5: unknown account a"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "b"
     },
     {
      "kind": "Close",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 3
     }
    ]
   ],
   "expected": {
    "ok": true,
    "value": [
     [
      "b",
      0
     ],
     [
      "a",
      3
     ]
    ]
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "b"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 10
     },
     {
      "kind": "Transfer",
      "src": "a",
      "dst": "b",
      "amount": 10
     },
     {
      "kind": "Close",
      "name": "a"
     },
     {
      "kind": "Transfer",
      "src": "b",
      "dst": "a",
      "amount": 1
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 6: unknown account a"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Close",
      "name": "a"
     },
     {
      "kind": "Close",
      "name": "a"
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 3: unknown account a"
   }
  }
 ],
 "regression": [
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 100
     },
     {
      "kind": "Withdraw",
      "name": "a",
      "amount": 30
     }
    ]
   ],
   "expected": {
    "ok": true,
    "value": [
     [
      "a",
      70
     ]
    ]
   }
  },
  {
   "args": [
    []
   ],
   "expected": {
    "ok": true,
    "value": []
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "b"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 50
     },
     {
      "kind": "Transfer",
      "src": "a",
      "dst": "b",
      "amount": 20
     }
    ]
   ],
   "expected": {
    "ok": true,
    "value": [
     [
      "a",
      30
     ],
     [
      "b",
      20
     ]
    ]
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "b"
     },
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 10
     },
     {
      "kind": "Transfer",
      "src": "a",
      "dst": "b",
      "amount": 10
     },
     {
      "kind": "Withdraw",
      "name": "b",
      "amount": 10
     }
    ]
   ],
   "expected": {
    "ok": true,
    "value": [
     [
      "b",
      0
     ],
     [
      "a",
      0
     ]
    ]
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Open",
      "name": "a"
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 2: duplicate account a"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "b",
      "amount": 5
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 2: unknown account b"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 0
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 2: invalid amount"
   }
  },
  {
   "args": [
    [
     {
      "kind": "Open",
      "name": "a"
     },
     {
      "kind": "Deposit",
      "name": "a",
      "amount": 10
     },
     {
      "kind": "Withdraw",
      "name": "a",
      "amount": 11
     }
    ]
   ],
   "expected": {
    "ok": false,
    "error": "step 3: insufficient funds"
   }
  }
 ]
}
```

### canon

```canon
type BankOp =
  | Open(name: String)
  | Deposit(name: String, amount: Int)
  | Withdraw(name: String, amount: Int)
  | Transfer(src: String, dst: String, amount: Int)
  | Close(name: String)

fn balance(accts: List[(String, Int)], name: String) -> Option[Int] {
  return accts
    |> filter(|a| a.0 == name)
    |> map(|a| a.1)
    |> first()
}

fn adjust(accts: List[(String, Int)], name: String, delta: Int) -> List[(String, Int)] {
  return map(accts, |a| add_if(a, name, delta))
}

fn add_if(a: (String, Int), name: String, delta: Int) -> (String, Int) {
  if a.0 == name {
    return (a.0, a.1 + delta)
  }
  return a
}

fn check(accts: List[(String, Int)], op: BankOp) -> Option[String] {
  let kind = match op {
    Open(_) => "open",
    Deposit(_, _) => "deposit",
    Withdraw(_, _) => "withdraw",
    Transfer(_, _, _) => "transfer",
    Close(_) => "close",
  }
  let src = match op {
    Open(n) => n,
    Deposit(n, _) => n,
    Withdraw(n, _) => n,
    Transfer(s, _, _) => s,
    Close(n) => n,
  }
  let dst = match op {
    Transfer(_, t, _) => t,
    _ => src,
  }
  let amount = match op {
    Open(_) => 1,
    Close(_) => 1,
    Deposit(_, a) => a,
    Withdraw(_, a) => a,
    Transfer(_, _, a) => a,
  }
  let src_bal = balance(accts, src)
  if kind == "open" {
    if src_bal != None {
      return Some("duplicate account " + src)
    }
    return None
  }
  if src_bal == None {
    return Some("unknown account " + src)
  }
  if balance(accts, dst) == None {
    return Some("unknown account " + dst)
  }
  if kind == "close" {
    if unwrap_or(src_bal, 0) != 0 {
      return Some("account " + src + " not empty")
    }
    return None
  }
  if kind == "transfer" && src == dst {
    return Some("same account")
  }
  if amount <= 0 {
    return Some("invalid amount")
  }
  if kind != "deposit" && amount > unwrap_or(src_bal, 0) {
    return Some("insufficient funds")
  }
  return None
}

fn apply(accts: List[(String, Int)], op: BankOp) -> List[(String, Int)] {
  return match op {
    Open(n) => append(accts, (n, 0)),
    Deposit(n, a) => adjust(accts, n, a),
    Withdraw(n, a) => adjust(accts, n, -a),
    Transfer(s, t, a) => adjust(adjust(accts, s, -a), t, a),
    Close(n) => filter(accts, |a| a.0 != n),
  }
}

fn bank_ledger(ops: List[BankOp]) -> Result[List[(String, Int)], String] {
  var accts = []
  for p in enumerate(ops) {
    let problem = check(accts, p.1)
    if problem != None {
      return Err("step " + to_string(p.0 + 1) + ": " + unwrap_or(problem, ""))
    }
    accts = apply(accts, p.1)
  }
  return Ok(accts)
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

class Open(TypedDict):
    kind: Literal["Open"]
    name: str

class Deposit(TypedDict):
    kind: Literal["Deposit"]
    name: str
    amount: int

class Withdraw(TypedDict):
    kind: Literal["Withdraw"]
    name: str
    amount: int

class Transfer(TypedDict):
    kind: Literal["Transfer"]
    src: str
    dst: str
    amount: int

class Close(TypedDict):
    kind: Literal["Close"]
    name: str

BankOp = Open | Deposit | Withdraw | Transfer | Close


class _LedgerError(Exception):
    pass


def _require(balances: dict[str, int], name: str) -> None:
    if name not in balances:
        raise _LedgerError(f"unknown account {name}")


def _check_amount(amount: int) -> None:
    if amount <= 0:
        raise _LedgerError("invalid amount")


def _check_funds(balance: int, amount: int) -> None:
    if amount > balance:
        raise _LedgerError("insufficient funds")


def _apply(balances: dict[str, int], op: BankOp) -> None:
    if op["kind"] == "Open":
        if op["name"] in balances:
            raise _LedgerError(f"duplicate account {op['name']}")
        balances[op["name"]] = 0
    elif op["kind"] == "Deposit":
        _require(balances, op["name"])
        _check_amount(op["amount"])
        balances[op["name"]] += op["amount"]
    elif op["kind"] == "Withdraw":
        _require(balances, op["name"])
        _check_amount(op["amount"])
        _check_funds(balances[op["name"]], op["amount"])
        balances[op["name"]] -= op["amount"]
    elif op["kind"] == "Close":
        _require(balances, op["name"])
        if balances[op["name"]] != 0:
            raise _LedgerError(f"account {op['name']} not empty")
        del balances[op["name"]]
    else:
        _require(balances, op["src"])
        _require(balances, op["dst"])
        if op["src"] == op["dst"]:
            raise _LedgerError("same account")
        _check_amount(op["amount"])
        _check_funds(balances[op["src"]], op["amount"])
        balances[op["src"]] -= op["amount"]
        balances[op["dst"]] += op["amount"]


def bank_ledger(ops: list[BankOp]) -> Ok[list[tuple[str, int]]] | Err:
    """Apply bank operations in order and return final balances.

    The first failing operation stops processing with an error of the form
    "step N: <reason>". Accounts are returned in the order they were opened.
    """
    balances: dict[str, int] = {}
    for step, op in enumerate(ops, start=1):
        try:
            _apply(balances, op)
        except _LedgerError as exc:
            return {"ok": False, "error": f"step {step}: {exc}"}
    return {"ok": True, "value": list(balances.items())}
```

### ts

```ts
type BankOp =
  | { kind: "Open"; name: string }
  | { kind: "Deposit"; name: string; amount: number }
  | { kind: "Withdraw"; name: string; amount: number }
  | { kind: "Transfer"; src: string; dst: string; amount: number }
  | { kind: "Close"; name: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bank_ledger(ops: BankOp[]): Result<[string, number][]> {
  const bal = new Map<string, number>();
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const fail = (msg: string): Result<[string, number][]> => ({ ok: false, error: "step " + (i + 1) + ": " + msg });
    if (op.kind === "Open") {
      if (bal.has(op.name)) return fail("duplicate account " + op.name);
      bal.set(op.name, 0);
    } else if (op.kind === "Close") {
      if (!bal.has(op.name)) return fail("unknown account " + op.name);
      if (bal.get(op.name) !== 0) return fail("account " + op.name + " not empty");
      bal.delete(op.name);
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
```

## k_most_frequent

Requirement: Change the tie-break: values with equal counts must now be ordered by the position of their first occurrence in xs (earliest first) instead of from smallest to largest value. This also decides which tied values are kept when k cuts through a group of equal counts.

```json
{
 "id": "k_most_frequent",
 "cases": [
  {
   "args": [
    [
     3,
     1,
     2
    ],
    3
   ],
   "expected": [
    [
     3,
     1
    ],
    [
     1,
     1
    ],
    [
     2,
     1
    ]
   ]
  },
  {
   "args": [
    [
     5,
     5,
     2,
     2,
     9
    ],
    2
   ],
   "expected": [
    [
     5,
     2
    ],
    [
     2,
     2
    ]
   ]
  },
  {
   "args": [
    [
     7,
     1,
     7,
     1,
     1,
     7,
     4
    ],
    3
   ],
   "expected": [
    [
     7,
     3
    ],
    [
     1,
     3
    ],
    [
     4,
     1
    ]
   ]
  },
  {
   "args": [
    [
     -1,
     4,
     -3,
     4,
     -1,
     -3
    ],
    2
   ],
   "expected": [
    [
     -1,
     2
    ],
    [
     4,
     2
    ]
   ]
  },
  {
   "args": [
    [
     10,
     2,
     2,
     10,
     3
    ],
    1
   ],
   "expected": [
    [
     10,
     2
    ]
   ]
  },
  {
   "args": [
    [
     8,
     6,
     4,
     2
    ],
    10
   ],
   "expected": [
    [
     8,
     1
    ],
    [
     6,
     1
    ],
    [
     4,
     1
    ],
    [
     2,
     1
    ]
   ]
  }
 ],
 "regression": [
  {
   "args": [
    [
     1,
     1,
     2,
     2,
     3
    ],
    2
   ],
   "expected": [
    [
     1,
     2
    ],
    [
     2,
     2
    ]
   ]
  },
  {
   "args": [
    [
     4,
     4,
     1,
     1,
     1,
     2
    ],
    2
   ],
   "expected": [
    [
     1,
     3
    ],
    [
     4,
     2
    ]
   ]
  },
  {
   "args": [
    [],
    3
   ],
   "expected": []
  },
  {
   "args": [
    [
     5
    ],
    0
   ],
   "expected": []
  },
  {
   "args": [
    [
     5,
     5
    ],
    -1
   ],
   "expected": []
  },
  {
   "args": [
    [
     7,
     7,
     7,
     3,
     3,
     9
    ],
    2
   ],
   "expected": [
    [
     7,
     3
    ],
    [
     3,
     2
    ]
   ]
  }
 ]
}
```

### canon

```canon
fn k_most_frequent(xs: List[Int], k: Int) -> List[(Int, Int)] {
  if k <= 0 {
    return []
  }
  let counted = map(group_by(xs, |x| x), |g| (g.0, len(g.1)))
  return take(sort_desc_by(counted, |p| p.1), k)
}
```

### py

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

from collections import Counter


def k_most_frequent(xs: list[int], k: int) -> list[tuple[int, int]]:
    """Return the k most frequent (value, count) pairs, by count desc then first appearance."""
    if k <= 0:
        return []
    ranked = sorted(Counter(xs).items(), key=lambda pair: -pair[1])
    return ranked[:k]
```

### ts

```ts
export function k_most_frequent(xs: number[], k: number): [number, number][] {
  if (k <= 0) return [];
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const pairs: [number, number][] = [...counts.entries()];
  pairs.sort((p, q) => q[1] - p[1]);
  return pairs.slice(0, k);
}
```

## elevator_scan

Requirement: Accept a third direction, "nearest": the elevator first moves toward whichever side has the requested floor closest to start, then sweeps as "up" or "down" would from there. If the closest floors above and below are equally far, it goes up; if there are requests on only one side, it goes that way (and with no requests on either side it behaves like "up"). "up" and "down" are unchanged.

```json
{
 "id": "elevator_scan",
 "cases": [
  {
   "args": [
    5,
    [
     3,
     9
    ],
    "nearest"
   ],
   "expected": [
    3,
    9
   ]
  },
  {
   "args": [
    5,
    [
     8,
     2
    ],
    "nearest"
   ],
   "expected": [
    8,
    2
   ]
  },
  {
   "args": [
    5,
    [
     7,
     3,
     5
    ],
    "nearest"
   ],
   "expected": [
    5,
    7,
    3
   ]
  },
  {
   "args": [
    5,
    [
     6,
     4
    ],
    "nearest"
   ],
   "expected": [
    6,
    4
   ]
  },
  {
   "args": [
    0,
    [
     -4,
     10,
     -1,
     6
    ],
    "nearest"
   ],
   "expected": [
    -1,
    -4,
    6,
    10
   ]
  },
  {
   "args": [
    5,
    [
     6,
     5,
     4,
     1
    ],
    "nearest"
   ],
   "expected": [
    5,
    6,
    4,
    1
   ]
  },
  {
   "args": [
    10,
    [
     11,
     9,
     12,
     8
    ],
    "nearest"
   ],
   "expected": [
    11,
    12,
    9,
    8
   ]
  }
 ],
 "regression": [
  {
   "args": [
    5,
    [],
    "up"
   ],
   "expected": []
  },
  {
   "args": [
    5,
    [
     5,
     5
    ],
    "down"
   ],
   "expected": [
    5
   ]
  },
  {
   "args": [
    5,
    [
     7,
     2,
     9,
     5,
     1,
     7
    ],
    "up"
   ],
   "expected": [
    5,
    7,
    9,
    2,
    1
   ]
  },
  {
   "args": [
    5,
    [
     7,
     2,
     9,
     5,
     1,
     7
    ],
    "down"
   ],
   "expected": [
    5,
    2,
    1,
    7,
    9
   ]
  },
  {
   "args": [
    0,
    [
     3,
     1,
     2
    ],
    "down"
   ],
   "expected": [
    1,
    2,
    3
   ]
  },
  {
   "args": [
    10,
    [
     3,
     1
    ],
    "up"
   ],
   "expected": [
    3,
    1
   ]
  },
  {
   "args": [
    3,
    [
     -2,
     4,
     -1,
     4
    ],
    "up"
   ],
   "expected": [
    4,
    -1,
    -2
   ]
  },
  {
   "args": [
    3,
    [
     -2,
     4,
     -1,
     4
    ],
    "down"
   ],
   "expected": [
    -1,
    -2,
    4
   ]
  }
 ]
}
```

### canon

```canon
fn elevator_scan(start: Int, requests: List[Int], direction: String) -> List[Int] {
  let floors = map(group_by(requests, |f| f), |g| g.0)
  let above = sort_by(filter(floors, |f| f > start), |f| f)
  let below = sort_desc_by(filter(floors, |f| f < start), |f| f)
  var out = filter(floors, |f| f == start)
  var rest = below
  let up_gap = unwrap_or(first(above), start) - start
  let down_gap = start - unwrap_or(first(below), start)
  let nearest_up = len(below) == 0 || len(above) > 0 && up_gap <= down_gap
  if direction == "up" || direction == "nearest" && nearest_up {
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

### py

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def elevator_scan(start: int, requests: list[int], direction: str) -> list[int]:
    """Return the order in which an elevator serves requested floors (SCAN)."""
    floors = set(requests)
    here = [start] if start in floors else []
    above = sorted(f for f in floors if f > start)
    below = sorted((f for f in floors if f < start), reverse=True)
    if direction == "nearest":
        nearest_up = not below or (bool(above) and above[0] - start <= start - below[0])
        direction = "up" if nearest_up else "down"
    if direction == "up":
        return here + above + below
    return here + below + above
```

### ts

```ts
export function elevator_scan(start: number, requests: number[], direction: string): number[] {
  const floors = [...new Set(requests)];
  const above = floors.filter((f) => f > start).sort((a, b) => a - b);
  const below = floors.filter((f) => f < start).sort((a, b) => b - a);
  const here = floors.includes(start) ? [start] : [];
  const nearestUp = below.length === 0 || (above.length > 0 && above[0] - start <= start - below[0]);
  const up = direction === "up" || (direction === "nearest" && nearestUp);
  return up ? [...here, ...above, ...below] : [...here, ...below, ...above];
}
```
