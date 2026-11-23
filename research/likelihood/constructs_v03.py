"""
Candidate Canon v0.3 spellings, for a second likelihood study (same method as constructs.py).

Each construct has three contexts (small programs written in Canon v0.2 style). A context is a
template with the slot {X}; each variant fills the slot with one spelling. Variants of one
construct mean the same thing. `canon` marks the spelling Canon v0.2 requires (or, where v0.2
has no spelling for the idea, the candidate the design notes lean towards; see the comment on
that construct). Variants that are not legal v0.2 are marked "not v0.2" in comments.

Some constructs differ in more than one place (a loop body, a whole helper function). For
those the variant is a whole program stored in the context under the variant's name, and the
template is just "{X}".
"""


def _whole(**programs):
    """A context whose variants are whole programs (keys are variant names)."""
    return dict(programs)


def _same(name_list):
    """Variant map for whole-program constructs: each variant is the context entry of that name."""
    return {n: "{" + n + "}" for n in name_list}


# --- builders -------------------------------------------------------------------------------


def _continue_ctx(head, loop, cond, neg, body, before, after):
    """Three spellings of 'skip the rest of this iteration when cond'."""
    ind = "    "
    b = "".join(f"{ind}{line}\n" for line in body)
    b2 = "".join(f"{ind}  {line}\n" for line in body)
    pre = head + "".join(f"  {line}\n" for line in before) + f"  {loop} {{\n"
    post = "  }\n" + "".join(f"  {line}\n" for line in after) + "}\n"
    return dict(
        # not v0.2: there is no continue
        **{"continue": pre + f"{ind}if {cond} {{\n{ind}  continue\n{ind}}}\n" + b + post},
        guard=pre + f"{ind}if {neg} {{\n" + b2 + f"{ind}}}\n" + post,
        **{"else": pre + f"{ind}if {cond} {{\n{ind}}} else {{\n" + b2 + f"{ind}}}\n" + post},
    )


def _destructure_ctx(head, src, a, b, body, before=(), after=(), pair="p"):
    """`for (a, b) in src` vs `for p in src` with p.0 / p.1 vs unpacking with let."""
    def render(lines, ra, rb):
        return "".join("    " + line.replace("@A", ra).replace("@B", rb) + "\n" for line in lines)

    pre = head + "".join(f"  {line}\n" for line in before)
    post = "  }\n" + "".join(f"  {line}\n" for line in after) + "}\n"
    return dict(
        # not v0.2: for takes a single name
        tuple=pre + f"  for ({a}, {b}) in {src} {{\n" + render(body, a, b) + post,
        field=pre + f"  for {pair} in {src} {{\n" + render(body, f"{pair}.0", f"{pair}.1") + post,
        unpack=pre + f"  for {pair} in {src} {{\n    let {a} = {pair}.0\n    let {b} = {pair}.1\n"
        + render(body, a, b) + post,
    )


def _to_indent(src):
    """Braces program -> Python-style colon + indentation (same keywords). Not v0.2."""
    out = []
    for line in src.splitlines():
        s = line.strip()
        lead = line[: len(line) - len(line.lstrip())]
        if s == "}":
            continue
        if s.startswith("} else"):
            s = s[2:]
        if s.endswith(" {"):
            s = s[:-2] + ":"
        out.append(lead + s)
    return "\n".join(out) + "\n"


def _brace_ctx(src):
    return dict(braces=src, indent=_to_indent(src))


def _let_ctx(src):
    # not v0.2: bare `x = e` declares only via var in v0.2
    return dict(let=src, bare=src.replace("let ", ""))


def _def_ctx(src):
    # not v0.2: def
    return dict(fn=src, **{"def": "\n".join(("def " + l[3:]) if l.startswith("fn ") else l for l in src.split("\n"))})


# --- programs -------------------------------------------------------------------------------

TYPES = "type Item {\n  sku: String,\n  qty: Int,\n  price: Float,\n}\n\n"

EARLY_EXIT = [
    _whole(
        # not v0.2: break
        brk="fn describe(n: Int) -> Unit\n  effects: io\n{\n  var d = 2\n  var hit = false\n"
        "  while d * d <= n {\n    if n % d == 0 {\n      hit = true\n      break\n    }\n    d = d + 1\n  }\n"
        "  if hit {\n    print(to_string(n) + \" = \" + to_string(d) + \" * \" + to_string(n / d))\n"
        "  } else {\n    print(to_string(n) + \" is prime\")\n  }\n}\n",
        flag="fn describe(n: Int) -> Unit\n  effects: io\n{\n  var d = 2\n  var hit = false\n"
        "  while not hit and d * d <= n {\n    if n % d == 0 {\n      hit = true\n    } else {\n      d = d + 1\n    }\n  }\n"
        "  if hit {\n    print(to_string(n) + \" = \" + to_string(d) + \" * \" + to_string(n / d))\n"
        "  } else {\n    print(to_string(n) + \" is prime\")\n  }\n}\n",
        ret="fn smallest_divisor(n: Int) -> Int {\n  var d = 2\n  while d * d <= n {\n    if n % d == 0 {\n"
        "      return d\n    }\n    d = d + 1\n  }\n  return 0\n}\n\n"
        "fn describe(n: Int) -> Unit\n  effects: io\n{\n  let d = smallest_divisor(n)\n"
        "  if d > 0 {\n    print(to_string(n) + \" = \" + to_string(d) + \" * \" + to_string(n / d))\n"
        "  } else {\n    print(to_string(n) + \" is prime\")\n  }\n}\n",
    ),
    _whole(
        brk="fn overdraft_day(amounts: List[Int]) -> Int {\n  var balance = 100\n  var day = 0\n  var hit = false\n"
        "  for a in amounts {\n    balance = balance + a\n    if balance < 0 {\n      hit = true\n      break\n    }\n"
        "    day = day + 1\n  }\n  if hit {\n    return day\n  }\n  return -1\n}\n",
        # v0.2 has no while over a List without indexing, so the flag guards the for body
        flag="fn overdraft_day(amounts: List[Int]) -> Int {\n  var balance = 100\n  var day = 0\n  var hit = false\n"
        "  for a in amounts {\n    if not hit {\n      balance = balance + a\n      if balance < 0 {\n        hit = true\n"
        "      } else {\n        day = day + 1\n      }\n    }\n  }\n  if hit {\n    return day\n  }\n  return -1\n}\n",
        ret="fn overdraft_day(amounts: List[Int]) -> Int {\n  var balance = 100\n  var day = 0\n"
        "  for a in amounts {\n    balance = balance + a\n    if balance < 0 {\n      return day\n    }\n"
        "    day = day + 1\n  }\n  return -1\n}\n",
    ),
    _whole(
        brk="fn read_until_quit() -> List[String]\n  effects: io\n{\n  var lines = []\n  while true {\n"
        "    let line = unwrap_or(read_line(), \"quit\")\n    if line == \"quit\" {\n      break\n    }\n"
        "    lines = append(lines, line)\n  }\n  return lines\n}\n",
        flag="fn read_until_quit() -> List[String]\n  effects: io\n{\n  var lines = []\n  var done = false\n"
        "  while not done {\n    let line = unwrap_or(read_line(), \"quit\")\n    if line == \"quit\" {\n"
        "      done = true\n    } else {\n      lines = append(lines, line)\n    }\n  }\n  return lines\n}\n",
        ret="fn read_until_quit() -> List[String]\n  effects: io\n{\n  var lines = []\n  while true {\n"
        "    let line = unwrap_or(read_line(), \"quit\")\n    if line == \"quit\" {\n      return lines\n    }\n"
        "    lines = append(lines, line)\n  }\n  return lines\n}\n",
    ),
]

CONTINUE = [
    _continue_ctx("fn total(lines: List[String]) -> Int {\n", "for line in lines", 'trim(line) == ""',
                  'trim(line) != ""', ["let n = unwrap_or(parse_int(trim(line)), 0)", "sum = sum + n"],
                  ["var sum = 0"], ["return sum"]),
    _continue_ctx(TYPES + "fn restock_report(items: List[Item]) -> Unit\n  effects: io\n{\n", "for i in items",
                  "i.qty > 10", "i.qty <= 10",
                  ["let need = 10 - i.qty", 'print(i.sku + ": order " + to_string(need))'], [], []),
    _continue_ctx("fn odd_square_sum(xs: List[Int]) -> Int {\n", "for x in xs", "x % 2 == 0", "x % 2 != 0",
                  ["let sq = x * x", "total = total + sq"], ["var total = 0"], ["return total"]),
]

DESTRUCTURE = [
    _destructure_ctx("fn numbered(lines: List[String]) -> Unit\n  effects: io\n{\n", "enumerate(lines)", "i", "line",
                     ['print(to_string(@A + 1) + ". " + @B)']),
    _destructure_ctx("fn dot(xs: List[Int], ys: List[Int]) -> Int {\n", "zip(xs, ys)", "a", "b",
                     ["total = total + @A * @B"], before=["var total = 0"], after=["return total"]),
    _destructure_ctx("type Order {\n  customer: String,\n  amount: Int,\n}\n\n"
                     "fn per_customer(orders: List[Order]) -> Unit\n  effects: io\n{\n",
                     "group_by(orders, |o| o.customer)", "name", "group",
                     ['print(@A + ": " + to_string(len(@B)) + " orders")']),
]

BRACES = [
    _brace_ctx("fn clamp(x: Int, lo: Int, hi: Int) -> Int {\n  if x < lo {\n    return lo\n  } else if x > hi {\n"
               "    return hi\n  } else {\n    return x\n  }\n}\n"),
    _brace_ctx("fn digits(n: Int) -> Int {\n  var count = 1\n  var rest = abs(n)\n  while rest >= 10 {\n"
               "    rest = rest / 10\n    count = count + 1\n  }\n  return count\n}\n"),
    _brace_ctx(TYPES + "fn stock_value(items: List[Item]) -> Float {\n  var total = 0.0\n  for i in items {\n"
               "    if i.qty > 0 {\n      total = total + to_float(i.qty) * i.price\n    }\n  }\n  return total\n}\n"),
]

LETS = [
    _let_ctx(TYPES + "fn summary(items: List[Item]) -> String {\n  let count = len(items)\n"
             "  let total = sum(map(items, |i| i.qty))\n  let avg = total / max(count, 1)\n"
             '  return to_string(count) + " items, avg qty " + to_string(avg)\n}\n'),
    _let_ctx("fn best_score(words: List[String]) -> Int {\n  var best = 0\n  for w in words {\n    let n = str_len(w)\n"
             "    let bonus = n * 2\n    if n + bonus > best {\n      best = n + bonus\n    }\n  }\n  return best\n}\n"),
    _let_ctx("fn load_port(path: String) -> Result[Int, Error]\n  effects: fs\n{\n  let text = try read_file(path)\n"
             '  let lines = split(text, "\\n")\n  let head = trim(unwrap_or(first(lines), ""))\n'
             "  let port = unwrap_or(parse_int(head), 8080)\n  return Ok(port)\n}\n"),
]

DEFS = [
    _def_ctx(TYPES + "fn restock(items: List[Item], n: Int) -> Float\n  effects: io\n  requires: n >= 0\n{\n"
             "  var total = 0.0\n  for i in items {\n    if i.qty < n {\n      print(i.sku)\n"
             "      total = total + to_float(n - i.qty) * i.price\n    }\n  }\n  return total\n}\n"),
    _def_ctx(TYPES + 'fn label(item: Item) -> String {\n  return item.sku + (match item.qty {\n    0 => " out",\n'
             '    _ => " in",\n  })\n}\n\nfn cheapest(items: List[Item]) -> List[String] {\n  return items\n'
             "    |> filter(|i| i.qty > 0)\n    |> sort_by(|i| i.price)\n    |> map(|i| label(i))\n}\n"),
    _def_ctx("fn square(x: Int) -> Int {\n  return x * x\n}\n\nfn sum_squares(xs: List[Int]) -> Int {\n"
             "  return sum(map(xs, |x| square(x)))\n}\n"),
]


CONSTRUCTS = [
    {
        "id": "logic-words-v03",
        "question": "Logical operators in v0.2 programs: and/or/not or &&/||/!?",
        "canon": "words",
        # symbols: not v0.2
        "variants": {"words": "{p} and not {q} or {r}", "symbols": "{p} && !{q} || {r}"},
        "contexts": [
            dict(pre=TYPES + "fn count_ok(items: List[Item], banned: List[String]) -> Int {\n  var count = 0\n"
                 "  for i in items {\n    if ", p="i.qty > 0", q="contains(banned, i.sku)", r="i.price == 0.0",
                 post=" {\n      count = count + 1\n    }\n  }\n  return count\n}\n"),
            dict(pre="fn drain(limit: Int, force: Bool) -> Int\n  effects: io\n{\n  var n = 0\n  var done = false\n"
                 "  while ", p="n < limit", q="done", r="force",
                 post=' {\n    let line = unwrap_or(read_line(), "")\n    done = line == ""\n    n = n + 1\n  }\n'
                 "  return n\n}\n"),
            dict(pre="fn keep(n: Int) -> Bool {\n  let small = n < 100\n  let ok = ", p="n > 0", q="small", r="n == 1",
                 post="\n  return ok\n}\n"),
        ],
        "template": "{pre}{X}{post}",
    },
    {
        "id": "early-exit",
        "question": "Stop a loop at the first hit: `break`, a done flag, or `return` (helper fn if needed)?",
        # v0.2 has no break; its reference says "return early". flag is also legal v0.2. brk: not v0.2
        "canon": "ret",
        "variants": _same(["brk", "flag", "ret"]),
        "contexts": EARLY_EXIT,
        "template": "{X}",
    },
    {
        "id": "continue",
        "question": "Skip the rest of an iteration: `continue`, negated `if` guard, or empty `if` + `else`?",
        "canon": "guard",
        "variants": _same(["continue", "guard", "else"]),
        "contexts": CONTINUE,
        "template": "{X}",
    },
    {
        "id": "single-expr-fn",
        "question": "One-expression function: block with return, `= e`, one-line block, or implicit final expr?",
        "canon": "block",
        "variants": {
            "block": "{sig} {{\n  return {e}\n}}",
            "eq": "{sig} = {e}",  # not v0.2
            "oneline": "{sig} {{ return {e} }}",  # not v0.2 (one statement per line)
            "implicit": "{sig} {{\n  {e}\n}}",  # not v0.2
        },
        "contexts": [
            dict(pre="", sig="fn double(x: Int) -> Int", e="x * 2",
                 post="\nfn quadruple(x: Int) -> Int {\n  return double(double(x))\n}\n"),
            dict(pre="type Person {\n  name: String,\n  age: Int,\n}\n\n", sig="fn is_adult(p: Person) -> Bool",
                 e="p.age >= 18", post="\nfn adults(people: List[Person]) -> List[Person] {\n"
                 "  return filter(people, |p| is_adult(p))\n}\n"),
            dict(pre=TYPES, sig="fn label(item: Item) -> String", e='item.sku + ": " + to_string(item.qty)',
                 post="\nfn labels(items: List[Item]) -> List[String] {\n  return map(items, |i| label(i))\n}\n"),
        ],
        "template": "{pre}{X}\n{post}",
    },
    {
        "id": "effects-place",
        "question": "Effects clause: own line, inline `effects: io {`, or `with io {` suffix?",
        "canon": "own-line",
        "variants": {
            "own-line": "{head}\n  effects: {e}\n{{",
            "inline": "{head} effects: {e} {{",  # not v0.2
            "with": "{head} with {e} {{",  # not v0.2
        },
        "contexts": [
            dict(head="fn greet(name: String) -> Unit", e="io", body='  print("hello, " + name)\n}\n'),
            dict(head="fn timed_fetch(url: String) -> Result[String, Error]", e="net, time",
                 body="  let start = now()\n  let page = try http_get(url)\n  let ms = now() - start\n"
                 '  return Ok(to_string(ms) + " ms: " + page)\n}\n'),
            dict(head="fn roll(sides: Int) -> Int", e="rand", body="  return random_int(1, sides + 1)\n}\n"),
        ],
        "template": "{X}\n{body}",
    },
    {
        "id": "test-effects",
        "question": "A test that uses an effect: own-line effects clause, inline clause, or none?",
        "canon": "none",  # v0.2: tests need no effects clause
        "variants": {
            "own-line": 'test "{name}"\n  effects: {e}\n{{',  # not v0.2
            "inline": 'test "{name}" effects: {e} {{',  # not v0.2
            "none": 'test "{name}" {{',
        },
        "contexts": [
            dict(pre='fn greet(name: String) -> Unit\n  effects: io\n{\n  print("hello, " + name)\n}\n\n',
                 name="greet prints", e="io", body='  greet("ada")\n  assert(true)\n}\n'),
            dict(pre='fn load(path: String) -> String\n  effects: fs\n{\n  return match read_file(path) {\n'
                 '    Ok(text) => text,\n    Err(_) => "",\n  }\n}\n\n',
                 name="fixture has three lines", e="fs",
                 body='  let lines = split(load("fixtures/a.txt"), "\\n")\n  assert(len(lines) == 3)\n}\n'),
            dict(pre="fn roll(sides: Int) -> Int\n  effects: rand\n{\n  return random_int(1, sides + 1)\n}\n\n",
                 name="roll stays in range", e="rand", body="  let r = roll(6)\n  assert(r >= 1 and r <= 6)\n}\n"),
        ],
        "template": "{pre}{X}\n{body}",
    },
    {
        "id": "fn-type-effects",
        "question": "Effects in a function type: `fn(A) -> B effects: io`, `-> B / io`, `-> io B`, or `-> B with io`?",
        # no v0.2 spelling exists; `clause` mirrors the declaration syntax and is the baseline here
        "canon": "clause",
        "variants": {
            "clause": "fn({a}) -> {b} effects: {e}",
            "slash": "fn({a}) -> {b} / {e}",
            "prefix": "fn({a}) -> {e} {b}",
            "with": "fn({a}) -> {b} with {e}",
        },
        "contexts": [
            dict(pre="fn each_line(lines: List[String], emit: ", a="String", b="Unit", e="io",
                 post=") -> Int\n  effects: io\n{\n  var n = 0\n  for line in lines {\n    emit(line)\n"
                 "    n = n + 1\n  }\n  return n\n}\n"),
            dict(pre="fn fetch_all(urls: List[String], get: ", a="String", b="Result[String, Error]", e="net",
                 post=") -> List[String]\n  effects: net\n{\n  var pages = []\n  for u in urls {\n"
                 '    let page = match get(u) {\n      Ok(text) => text,\n      Err(_) => "",\n    }\n'
                 "    pages = append(pages, page)\n  }\n  return pages\n}\n"),
            dict(pre="fn sample(n: Int, pick: ", a="Int", b="Int", e="rand",
                 post=") -> List[Int]\n  effects: rand\n{\n  var out = []\n  for i in range(0, n) {\n"
                 "    out = append(out, pick(i))\n  }\n  return out\n}\n"),
        ],
        "template": "{pre}{X}{post}",
    },
    {
        "id": "for-destructure",
        "question": "Looping over pairs: `for (i, x) in ...`, `for p in ...` with p.0/p.1, or let-unpack?",
        "canon": "field",
        "variants": _same(["tuple", "field", "unpack"]),
        "contexts": DESTRUCTURE,
        "template": "{X}",
    },
    {
        "id": "braces-vs-indent",
        "question": "Blocks: braces or colon + indentation?",
        "canon": "braces",
        "variants": _same(["braces", "indent"]),
        "contexts": BRACES,
        "template": "{X}",
    },
    {
        "id": "let-keyword",
        "question": "Immutable local: `let x = e` or bare `x = e`?",
        "canon": "let",
        "variants": _same(["let", "bare"]),
        "contexts": LETS,
        "template": "{X}",
    },
    {
        "id": "fn-keyword",
        "question": "Function keyword: `fn` or `def`?",
        "canon": "fn",
        "variants": _same(["fn", "def"]),
        "contexts": DEFS,
        "template": "{X}",
    },
    {
        "id": "range-loop",
        "question": "Counting loop: `for i in range(0, n)` or `var i` + `while i < n`? (both v0.2)",
        "canon": "for-range",
        "variants": {
            "for-range": "{before}  for i in range({lo}, {hi}) {{\n{body}  }}\n",
            "while": "{before}  var i = {lo}\n  while i < {hi} {{\n{body}    i = i + 1\n  }}\n",
        },
        "contexts": [
            dict(head="fn square_sum(n: Int) -> Int {\n", before="  var total = 0\n", lo="0", hi="n",
                 body="    total = total + i * i\n", after="  return total\n}\n"),
            dict(head="fn count_up(n: Int) -> Unit\n  effects: io\n{\n", before="", lo="1", hi="n + 1",
                 body="    print(to_string(i))\n", after="}\n"),
            dict(head="fn steps(k: Int, step: Int) -> List[Int] {\n", before="  var xs = []\n", lo="0", hi="k",
                 body="    xs = append(xs, i * step)\n", after="  return xs\n}\n"),
        ],
        "template": "{head}{X}{after}",
    },
    {
        "id": "string-interp",
        "question": "Building strings: `+` with to_string, or interpolation `\"{x}\"` / `\"${x}\"`?",
        "canon": "plus",
        "variants": {"plus": "{plus}", "brace": "{brace}", "dollar": "{dollar}"},  # brace, dollar: not v0.2
        "contexts": [
            dict(pre='fn greet(name: String) -> Unit\n  effects: io\n{\n  print(', plus='"hello, " + name + "!"',
                 brace='"hello, {name}!"', dollar='"hello, ${name}!"', post=")\n}\n"),
            dict(pre="fn summary(count: Int, total: Float) -> String {\n  return ",
                 plus='to_string(count) + " items, total " + to_string(total)',
                 brace='"{count} items, total {total}"', dollar='"${count} items, total ${total}"', post="\n}\n"),
            dict(pre=TYPES + "fn line(item: Item) -> String {\n  return ",
                 plus='item.sku + " x" + to_string(item.qty)', brace='"{item.sku} x{item.qty}"',
                 dollar='"${item.sku} x${item.qty}"', post="\n}\n"),
        ],
        "template": "{pre}{X}{post}",
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
