# Canon-Py (prototype): Canon's guarantees with Python's surface syntax

A strict, canonical, effect-typed subset of Python 3.12 syntax. With one exception (the compact
`type` line for sum types), every Canon-Py file is ordinary Python, and it means the same thing as
that Python. Files end in `.cnpy`. This is a measurement prototype, not a spec. It runs through
`canonpy.py` (desugar plus shim) and `test_canonpy.py`.

## Text and form
- There is one canonical layout, Black-style: 4-space indent, 2 blank lines between top-level
  definitions, double-quoted strings, at most 88 columns. A formatter would reject any other layout.
  Comments are whole lines starting with `#`.
- There are no imports. Records use `@dataclass` with no import line (it is a builtin).

## Types
- Use `int`, `float`, `bool`, `str`, `list[T]`, `dict[K, V]`, `set[T]` and `tuple[A, B]`.
  Option is `T | None`. `Result[T, E]` is built in, with `Ok(value)` and `Err(error)`.
- Records are `@dataclass` classes with typed fields only: no methods and no inheritance.
- Sum types use a compact line. **This is not legal Python**; the desugarer turns it into one
  dataclass per variant:
  `type Op = Deposit(amount: int) | Withdraw(amount: int)`. Past 88 columns it wraps to
  `type Shape = (` followed by one `Variant(...)` per line, each line after the first starting `| `,
  then `)`.
- Every `def` has full parameter and return annotations. Locals are never annotated, as in Canon.

## Functions and effects
- Effects go in a decorator line above the `def`: `@effects(io, fs)`. No decorator means pure.
  Contracts are optional and read `@requires(n >= 0)` and `@ensures(len(result) == n)`, using a
  bare expression where `result` is the return value. **These are not legal Python** as written,
  because the expression is evaluated lazily by the checker.
- `return` is explicit. There are no default arguments, `*args`, `**kwargs`, global mutable state,
  classes with behaviour, exceptions (`try`/`raise`), `with`, generators or `async`.
- Error propagation is `x = try_(e)`, where `e` is a Result. It yields the Ok value, or returns
  the Err from the enclosing function. The postfix spelling `e?` was scored as a variant; it is not
  legal Python.

## Statements and expressions
- Allowed statements: `x = e` (rebinding is allowed), the augmented forms `+=` `-=` `*=` `//=`
  `%=`, tuple unpacking `a, b = b, a + b`, `if`/`elif`/`else`, `for x in xs`,
  `for i, x in enumerate(xs)`, `while`, `break`, `continue` and `match`/`case`. `match` uses
  class, literal, capture, `_` and `None` patterns.
- Conditions must be `bool`. There is no truthiness: write `len(xs) == 0`, not `not xs`.
- Allowed expressions: list comprehensions with a single `for` and an optional `if`, including
  nested comprehensions. Generator expressions are not allowed: write `sum([...])`. Also allowed:
  single-expression `lambda` (as an argument only), conditional expressions, f-strings, indexing
  (negative indexes too), slicing without a step, `in` / `not in`, `and` / `or` / `not`, and
  `is None` / `is not None`.
- Builtins: `len`, `range`, `enumerate` (`start=`), `zip`, `sum`, `min`, `max`, `sorted` (`key=`,
  `reverse=`, stable), `reversed`, `abs`, `str`, `int` (it traps on bad text), `float`, `set`,
  `list`, `print` (effect `io`), and `parse_int` (`-?[0-9]+` -> `int | None`; this one is new and
  not in Python).
- Methods form a closed set. str: `split`, `strip`, `join`, `count`, `startswith`, `endswith`.
  list: `append`, `pop`, `count`. set: `add`. dict: `get`, `items`, `keys`, `values`. All other
  methods are rejected, including `sort`, `extend`, `replace` and `isdigit`.
- Semantics are exactly Python's: `//` floors, and `int(a / b)` truncates toward zero.

## The two program sets
- `idiomatic/`: all 50 tasks, written fresh in Canon-Py by the same author as `../tokens/python`.
  Comparing it with typed Python isolates the cost of the subset's restrictions.
- `translit/`: 20 tasks (all 10 hard, 10 basic). Each is the modal Claude Canon v0.2 program
  carried over to Canon-Py with the same algorithm, helpers and names. Workarounds for things Canon
  lacks are replaced by the Canon-Py facility: indexing instead of `nth` or `unwrap_or(first(...))`,
  `for c in s` instead of `split(s, "")`, `max(xs)` instead of `fold`, `in` on strings, a dict
  instead of `group_by`, and comprehensions instead of `map`/`filter`. Things Canon has are kept as
  the model wrote them: the `is_int` helpers, `empty_stack`, contracts and the `try` propagation
  structure. This is the closest available to a like-for-like syntax comparison with Canon v0.2.
