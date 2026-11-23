"""
Equivalent spellings of Canon constructs, for the likelihood study (SPEC.md, M8).

Each construct has three contexts (small programs). A context is a template with the slot
{X}; each variant fills the slot with one spelling. Variants of one construct mean the
same thing, so the model's log-probability of the whole program measures which spelling
it finds most natural. `canon` marks the spelling Canon v0 requires today; variants that
are not legal Canon are included on purpose (the study asks what Canon *should* pick).
"""

CONSTRUCTS = [
    {
        "id": "pipeline-3",
        "question": "Three chained calls: pipeline or nested calls?",
        "canon": "pipeline",
        "variants": {
            "pipeline": "{a}\n    |> {f1}\n    |> {f2}\n    |> {f3}",
            "nested": "{f3n}({f2n}({f1n}({a}{f1a}){f2a}){f3a})",
        },
        "contexts": [
            dict(sig="fn cheapest(items: List[Item], k: Int) -> List[String]", a="items",
                 f1="filter(|i| i.qty > 0)", f2="sort_by(|i| i.price)", f3="take(k)",
                 f1n="filter", f1a=", |i| i.qty > 0", f2n="sort_by", f2a=", |i| i.price", f3n="take", f3a=", k"),
            dict(sig="fn even_squares(xs: List[Int]) -> List[Int]", a="xs",
                 f1="filter(|x| x % 2 == 0)", f2="map(|x| x * x)", f3="reverse()",
                 f1n="filter", f1a=", |x| x % 2 == 0", f2n="map", f2a=", |x| x * x", f3n="reverse", f3a=""),
            dict(sig="fn word_lengths(text: String) -> List[Int]", a="text",
                 f1='split(" ")', f2="filter(|w| str_len(w) > 0)", f3="map(|w| str_len(w))",
                 f1n="split", f1a=', " "', f2n="filter", f2a=", |w| str_len(w) > 0", f3n="map", f3a=", |w| str_len(w)"),
        ],
        "template": "{sig} {{\n  return {X}\n}}\n",
    },
    {
        "id": "pipeline-2",
        "question": "Two chained calls: pipeline or nested calls?",
        "canon": "nested",
        "variants": {
            "pipeline": "{a}\n    |> {f1}\n    |> {f2}",
            "nested": "{f2n}({f1n}({a}{f1a}){f2a})",
        },
        "contexts": [
            dict(sig="fn in_stock(items: List[Item]) -> Int", a="items",
                 f1="filter(|i| i.qty > 0)", f2="len()", f1n="filter", f1a=", |i| i.qty > 0", f2n="len", f2a=""),
            dict(sig="fn doubled(xs: List[Int]) -> List[Int]", a="xs",
                 f1="map(|x| x * 2)", f2="reverse()", f1n="map", f1a=", |x| x * 2", f2n="reverse", f2a=""),
            dict(sig="fn first_word(text: String) -> Option[String]", a="text",
                 f1='split(" ")', f2="first()", f1n="split", f1a=', " "', f2n="first", f2a=""),
        ],
        "template": "{sig} {{\n  return {X}\n}}\n",
    },
    {
        "id": "bool-true",
        "question": "Testing a Bool: `x` or `x == true`?",
        "canon": "bare",
        "variants": {"bare": "{v}", "eq-true": "{v} == true"},
        "contexts": [dict(v="item.active"), dict(v="is_ready(job)"), dict(v="done")],
        "template": "fn check(item: Item, job: Job, done: Bool) -> Int {{\n  if {X} {{\n    return 1\n  }}\n  return 0\n}}\n",
    },
    {
        "id": "bool-false",
        "question": "Negating a Bool: `not x` or `x == false`?",
        "canon": "not",
        "variants": {"not": "not {v}", "eq-false": "{v} == false"},
        "contexts": [dict(v="item.active"), dict(v="is_ready(job)"), dict(v="done")],
        "template": "fn check(item: Item, job: Job, done: Bool) -> Int {{\n  if {X} {{\n    return 1\n  }}\n  return 0\n}}\n",
    },
    {
        "id": "logic-words",
        "question": "Logical operators: words (and/or/not) or symbols (&&/||/!)?",
        "canon": "words",
        "variants": {"words": "{p} and not {q} or {r}", "symbols": "{p} && !{q} || {r}"},
        "contexts": [
            dict(p="item.qty > 0", q="is_discontinued(item)", r="item.price == 0.0"),
            dict(p="user.active", q="user.banned", r="user.admin"),
            dict(p="n > 0", q="is_even(n)", r="n == 1"),
        ],
        "template": "fn keep(item: Item, user: User, n: Int) -> Bool {{\n  return {X}\n}}\n",
    },
    {
        "id": "mutation",
        "question": "Assigning to a mutable local: `set x = ...` or `x = ...`?",
        "canon": "set",
        "variants": {"set": "set {v} = {e}", "bare": "{v} = {e}"},
        "contexts": [
            dict(init="0", v="total", e="total + x"),
            dict(init="1", v="product", e="product * x"),
            dict(init="0", v="count", e="count + 1"),
        ],
        "template": "fn run(xs: List[Int]) -> Int {{\n  var {v} = {init}\n  for x in xs {{\n    {X}\n  }}\n  return {v}\n}}\n",
    },
    {
        "id": "while-loop",
        "question": "A condition loop: `for cond { }` or `while cond { }`?",
        "canon": "for",
        "variants": {"for": "for {c} {{", "while": "while {c} {{"},
        "contexts": [dict(c="i < n"), dict(c="len(queue) > 0"), dict(c="not done")],
        "template": "fn run(n: Int, queue: List[Int], done: Bool) -> Int {{\n  var i = 0\n  {X}\n    set i = i + 1\n  }}\n  return i\n}}\n",
    },
    {
        "id": "effects-placement",
        "question": "Where the effects clause goes: its own line, or inline before `{`?",
        "canon": "own-line",
        "variants": {
            "own-line": "{head}\n  effects: {e}\n{{",
            "inline": "{head} effects: {e} {{",
        },
        "contexts": [
            dict(head="fn greet(name: String) -> Unit", e="io"),
            dict(head="fn fetch(url: String) -> Result[String, Error]", e="net, time"),
            dict(head="fn roll() -> Int", e="rand"),
        ],
        "template": "{X}\n  return body()\n}}\n",
    },
    {
        "id": "trailing-comma",
        "question": "Record fields, one per line: trailing comma or not? (open question in SPEC.md)",
        "canon": "trailing",
        "variants": {
            "trailing": "type {t} {{\n{fields}\n}}",
            "none": "type {t} {{\n{fields_nc}\n}}",
        },
        "contexts": [
            dict(t="Item", fields="  sku: String,\n  qty: Int,\n  price: Float,", fields_nc="  sku: String,\n  qty: Int,\n  price: Float"),
            dict(t="Point", fields="  x: Int,\n  y: Int,", fields_nc="  x: Int,\n  y: Int"),
            dict(t="User", fields="  name: String,\n  email: String,\n  active: Bool,", fields_nc="  name: String,\n  email: String,\n  active: Bool"),
        ],
        "template": "{X}\n",
    },
    {
        "id": "else-if",
        "question": "A second condition: `else if` or `else { if ... }`?",
        "canon": "else-if",
        "variants": {
            "else-if": "if {a} {{\n    return {ra}\n  }} else if {b} {{\n    return {rb}\n  }}",
            "else-block": "if {a} {{\n    return {ra}\n  }} else {{\n    if {b} {{\n      return {rb}\n    }}\n  }}",
        },
        "contexts": [
            dict(a="n < 0", ra='"negative"', b="n == 0", rb='"zero"'),
            dict(a="score > 90", ra='"A"', b="score > 80", rb='"B"'),
            dict(a="len(xs) == 0", ra='"empty"', b="len(xs) == 1", rb='"one"'),
        ],
        "template": "fn label(n: Int, score: Int, xs: List[Int]) -> String {{\n  {X}\n  return \"other\"\n}}\n",
    },
    {
        "id": "string-join",
        "question": "Joining strings: `concat(a, b)` or `a + b`?",
        "canon": "concat",
        "variants": {"concat": "concat({a}, {b})", "plus": "{a} + {b}"},
        "contexts": [
            dict(a='"hello, "', b="name"),
            dict(a="first", b="last"),
            dict(a="to_string(n)", b='" items"'),
        ],
        "template": "fn text(name: String, first: String, last: String, n: Int) -> String {{\n  return {X}\n}}\n",
    },
    {
        "id": "lambda",
        "question": "Lambda syntax: `|x| x + 1` or `(x) => x + 1`?",
        "canon": "bars",
        "variants": {"bars": "|{p}| {body}", "arrow": "({p}) => {body}"},
        "contexts": [
            dict(f="map", p="x", body="x * 2"),
            dict(f="filter", p="i", body="i.qty > 0"),
            dict(f="sort_by", p="u", body="u.name"),
        ],
        "template": "fn run(xs: List[Item]) -> List[Item] {{\n  return {f}(xs, {X})\n}}\n",
    },
    {
        "id": "match-arm-comma",
        "question": "Match arms, one per line: trailing comma or not?",
        "canon": "comma",
        "variants": {"comma": "{a1},\n    {a2},", "none": "{a1}\n    {a2}"},
        "contexts": [
            dict(s="o", a1="Some(v) => v", a2="None => 0"),
            dict(s="r", a1="Ok(n) => n", a2="Err(_) => -1"),
            dict(s="b", a1="true => 1", a2="false => 0"),
        ],
        "template": "fn pick(o: Option[Int], r: Result[Int, Error], b: Bool) -> Int {{\n  return match {s} {{\n    {X}\n  }}\n}}\n",
    },
    {
        "id": "explicit-return",
        "question": "Function result: explicit `return e` or a final bare expression?",
        "canon": "return",
        "variants": {"return": "return {e}", "implicit": "{e}"},
        "contexts": [dict(e="a + b"), dict(e="len(xs) * 2"), dict(e='concat("id-", to_string(n))')],
        "template": "fn f(a: Int, b: Int, xs: List[Int], n: Int) -> Int {{\n  let unused = 0\n  {X}\n}}\n",
    },
]


def programs(construct):
    """Yield (context_index, variant_name, program_text)."""
    for ci, ctx in enumerate(construct["contexts"]):
        for name, spelling in construct["variants"].items():
            x = spelling.format(**ctx)
            ctx2 = dict(ctx)
            ctx2["X"] = x
            yield ci, name, construct["template"].format(**ctx2)
