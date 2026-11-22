## The language

This is the whole language reference an agent loads. Every code sample here passes `canon check`.

**Files and text.** Source files end in `.cn`. Blocks use braces, indentation is two spaces, and statements sit one per line. Comments start with `#` and take a whole line. Strings use double quotes only. Values, functions, fields and effects are `snake_case`; types and variants are `PascalCase`. One line rule matters to the parser: a call's `(` sits on the same line as the function name.

**Types.** Built in: `Int`, `Float`, `Bool`, `String`, `Unit`, `List[T]`, `Map[K, V]`, `Option[T]`, `Result[T, E]`, tuples `(A, B)`, and function types `fn(A) -> B`. Declare records and sum types like this:

```
type Item {
  sku: String,
  qty: Int,
  price: Float,
}

type Step =
  | Call(tool: String, input: Json)
  | Answer(text: String)
  | Fail(reason: String)
```

**Functions.** Parameter and return types are always written. Optional clauses follow the signature in the fixed order `effects`, `requires`, `ensures`; `result` names the return value inside `ensures`. Leaving out `effects` means pure. The effects are `fs`, `io`, `net`, `rand`, `time`, listed exactly and alphabetically.

```
fn restock_cost(items: List[Item], target: Int) -> Float
  requires: target >= 0
  ensures: result >= 0.0
{
  var total = 0.0
  for item in items {
    if item.qty < target and not is_discontinued(item) {
      set total = total + to_float(target - item.qty) * item.price
    }
  }
  return total
}
```

**Statements.** `let` binds an immutable name, `var` a mutable one, and `set` assigns to a `var` (so every mutation is searchable). Locals never carry type annotations. `return` is always explicit. `if` / `else if` / `else` is the only conditional statement. `for x in xs { }` walks a collection and `for cond { }` repeats while true; there is no other loop. A bare expression statement must be a call.

**Expressions.** Precedence, loosest first:

| Level | Operators |
| --- | --- |
| 0 | `\|>` pipeline, lambdas `\|a, b\| expr` |
| 1 | `or` |
| 2 | `and` |
| 3 | `not` |
| 4 | `==` `!=` `<` `<=` `>` `>=` (never chained) |
| 5 | `+` `-` |
| 6 | `*` `/` `%` |
| 7 | unary `-`, `try` |
| 8 | calls `f(x)`, fields `a.b`, tuple slots `t.0` |

Only named functions are called; there are no methods. Literals: `[1, 2]`, `(a, b)`, `Item { sku: "a", qty: 1, price: 2.5 }`. A lambda body is one expression. `try e` unwraps a `Result` or returns its error early. `match` is allowed only as the whole value of `let`, `set` or `return`, with one arm per line:

```
let band = match (item.qty > 0, item.price) {
  (false, _) => "out",
  (true, 0.0) => "free",
  _ => "priced",
}
```

**The pipeline rule.** `x |> f(y)` means `f(x, y)`. Whether a chain is written as a pipeline or as nested calls is not a choice: three or more chained calls are a pipeline with one stage per line, and fewer are nested calls. A call whose first argument is a literal (`range(0, n)`) starts a pipeline but never becomes a stage.

```
return items
  |> filter(|i| i.qty > 0 and i.price > 0.0)
  |> sort_by(|i| i.price)
  |> take(k)
  |> map(|i| i.sku)
```

**Holes.** Write `?` or `?name` where you are unsure. The compiler reports the type the hole needs and the functions in scope that return it, then you fill it.

**What `fmt` collapses.** The checker rejects any file `fmt` would change, and the error carries the patch. These all collapse to one form: whitespace and blank lines; redundant parentheses; optional commas; `else { if … }` to `else if`; `x == true` to `x` and `x == false` to `not x`; `not not x` to `x`; `007` to `7` and `1.50` to `1.5`; import order and duplicates; effect order; clause order; pipeline versus nested call.
