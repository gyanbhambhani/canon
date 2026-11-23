"""
Canon v0.4 ("Canon-Py") spelling candidates, scored in Python-shaped contexts.

Same method as research/likelihood (constructs.py, constructs_v03.py): each construct is written
in several equivalent spellings inside three small programs, and every program is scored by its
total log-probability under a local base model after the same one-line header. The difference
from the v0.3 study is the context: every program here is written in the candidate v0.4 surface
(def, indentation, Python type names, decorators, f-strings). The question is "which spelling
is most natural inside Python-shaped Canon", not inside brace-syntax Canon.

`chosen` marks the spelling v0.4 adopted. It is the draft's candidate everywhere except records
and blank lines, which changed after the 1.5B scores. For the re-tests of braces and `fn`, it is
the Python-shaped baseline. docs/v0.4-design.md records each
ruling.

Each context is a dict {variant name: whole program text}.
"""

import re

ITEM = "@dataclass\nclass Item:\n    sku: str\n    qty: int\n    price: float\n\n\n"

CONSTRUCTS: list[dict] = []


def construct(id, question, chosen, contexts):
    CONSTRUCTS.append({"id": id, "question": question, "chosen": chosen, "contexts": contexts})


def fill(src: str, **subs) -> str:
    for k, v in subs.items():
        src = src.replace("@" + k, v)
    return src


# 1. logical operators ---------------------------------------------------------------------------
_LOGIC = [
    (ITEM + "def count_ok(items: list[Item], banned: list[str]) -> int:\n    count = 0\n"
     "    for i in items:\n        if @X:\n            count += 1\n    return count\n",
     "i.qty > 0", "i.sku in banned", "i.price == 0.0"),
    ("@effects(io)\ndef drain(limit: int, force: bool) -> int:\n    n = 0\n    done = False\n"
     "    while @X:\n        line = unwrap_or(read_line(), \"\")\n        done = line == \"\"\n        n += 1\n"
     "    return n\n", "n < limit", "done", "force"),
    ("def keep(n: int) -> bool:\n    small = n < 100\n    ok = @X\n    return ok\n", "n > 0", "small", "n == 1"),
]
construct("logic-ops", "Logical operators: and/or/not or &&/||/!?", "words", [
    {"words": fill(s, X=f"{p} and not {q} or {r}"), "symbols": fill(s, X=f"{p} && !{q} || {r}")}
    for s, p, q, r in _LOGIC])

# 2. declared effects ------------------------------------------------------------------------------
_EFF = [
    ("def greet(name: str) -> None:", "None", "io", '    print(f"hello, {name}")\n',
     "\n\n@effects(io)\ndef main() -> None:\n    greet(\"canon\")\n"),
    ("def fetch_title(url: str) -> Result[str, Error]:", "Result[str, Error]", "net, time",
     "    start = now()\n    page = try_(http_get(url))\n    ms = now() - start\n"
     "    return Ok(f\"{len(page)} bytes in {ms} ms\")\n", ""),
    ("def save_report(path: str, lines: list[str]) -> Result[None, Error]:", "Result[None, Error]", "fs",
     '    return write_file(path, join(lines, "\\n"))\n', ""),
]
construct("effects", "Declared effects: decorator, docstring tag, trailing comment, or return-type wrapper?", "decorator", [
    {"decorator": f"@effects({e})\n{sig}\n{body}{post}",
     "docstring": f"{sig}\n    \"\"\"effects: {e}\"\"\"\n{body}{post}",
     "comment": f"{sig}  # effects: {e}\n{body}{post}",
     "rettype": sig.replace("-> " + ret, f"-> Effect[{ret}, {e.replace(', ', ' | ')}]") + f"\n{body}{post}"}
    for sig, ret, e, body, post in _EFF])

# 3. contracts ------------------------------------------------------------------------------------
_CON = [
    ("", "def isqrt(n: int) -> int:", "n >= 0", "result * result <= n",
     "    r = 0\n    while (r + 1) * (r + 1) <= n:\n        r += 1\n", "r"),
    ("", "def take_last(xs: list[int], k: int) -> list[int]:", "k >= 0 and k <= len(xs)", "len(result) == k",
     "    out = drop(xs, len(xs) - k)\n", "out"),
    (ITEM, "def restock_cost(items: list[Item], target: int) -> float:", "target >= 0", "result >= 0.0",
     "    total = 0.0\n    for item in items:\n        if item.qty < target:\n"
     "            total += to_float(target - item.qty) * item.price\n", "total"),
]
construct("contracts", "Contracts: @requires/@ensures decorators, asserts at entry and before return, or a docstring?",
          "decorators", [
              {"decorators": f"{pre}@requires({req})\n@ensures({ens})\n{sig}\n{body}    return {res}\n",
               "asserts": f"{pre}{sig}\n    assert {req}\n{body}    result = {res}\n    assert {ens}\n    return result\n",
               "docstring": f"{pre}{sig}\n    \"\"\"requires: {req}\n    ensures: {ens}\n    \"\"\"\n{body}    return {res}\n"}
              for pre, sig, req, ens, body, res in _CON])

# 4. records --------------------------------------------------------------------------------------
_REC = [
    ("Item", [("sku", "str"), ("qty", "int")], "\n\ndef make(sku: str) -> Item:\n    return Item(sku=sku, qty=1)\n"),
    ("User", [("name", "str"), ("email", "str"), ("age", "int")],
     "\n\ndef is_adult(u: User) -> bool:\n    return u.age >= 18\n"),
    ("Point", [("x", "float"), ("y", "float")],
     "\n\ndef shift(p: Point, dx: float) -> Point:\n    return Point(x=p.x + dx, y=p.y)\n"),
]


def _rec(head, name, fields, post):
    return head.replace("@N", name) + "".join(f"    {n}: {t}\n" for n, t in fields) + post


construct("records", "Records: @dataclass class, plain class, NamedTuple, or frozen dataclass?", "class", [
    {"dataclass": _rec("@dataclass\nclass @N:\n", *c), "class": _rec("class @N:\n", *c),
     "namedtuple": _rec("class @N(NamedTuple):\n", *c), "frozen": _rec("@dataclass(frozen=True)\nclass @N:\n", *c)}
    for c in _REC])

# 5. sum types -------------------------------------------------------------------------------------
_SUM = [
    ("Shape", [("Circle", [("r", "float")]), ("Rect", [("w", "float"), ("h", "float")])],
     "\n\ndef area(s: Shape) -> float:\n    match s:\n        case Circle(r):\n            return 3.14 * r * r\n"
     "        case Rect(w, h):\n            return w * h\n"),
    ("Op", [("Deposit", [("amount", "int")]), ("Withdraw", [("amount", "int")])],
     "\n\ndef apply(balance: int, op: Op) -> int:\n    match op:\n        case Deposit(amount):\n"
     "            return balance + amount\n        case Withdraw(amount):\n            return balance - amount\n"),
    ("Step", [("Call", [("tool", "str"), ("input", "str")]), ("Answer", [("text", "str")]), ("Fail", [("reason", "str")])],
     "\n\ndef done(s: Step) -> bool:\n    match s:\n        case Call(tool, input):\n            return False\n"
     "        case Answer(text):\n            return True\n        case Fail(reason):\n            return True\n"),
]


def _sum_compact(name, vs, post):
    body = " | ".join(f"{v}({', '.join(f'{n}: {t}' for n, t in fs)})" for v, fs in vs)
    return f"type {name} = {body}\n" + post


def _sum_dataclass(name, vs, post, alias):
    parts = [f"@dataclass\nclass {v}:\n" + "".join(f"    {n}: {t}\n" for n, t in fs) for v, fs in vs]
    return "\n\n".join(parts) + f"\n\n{alias}{name} = {' | '.join(v for v, _ in vs)}\n" + post


construct("sums", "Sum types: one `type` line with variant fields, or one dataclass per variant plus a union alias?",
          "compact", [{"compact": _sum_compact(*c), "dataclasses": _sum_dataclass(*c, "type "),
                       "dataclasses-bare-alias": _sum_dataclass(*c, "")} for c in _SUM])

# 6. Result propagation --------------------------------------------------------------------------
_TRY = [
    ('def parse(s: str) -> Result[int, str]:\n    match parse_int(s):\n        case Some(n):\n'
     '            return Ok(n)\n        case None:\n            return Err(f"not a number: {s}")\n\n\n',
     "def total(a: str, b: str) -> Result[int, str]:", "parse(a)", "parse(b)", "Ok(x + y)"),
    ("@effects(fs)\n", "def load(path: str) -> Result[int, Error]:", "read_file(path)", "parse_config(x)", "Ok(len(y))"),
    ("", "def checkout(cart: Cart, user: User) -> Result[Receipt, str]:", "validate(cart)", "charge(user, x)",
     "Ok(Receipt(total=y))"),
]
construct("try", "Result propagation: try_(e), e?, propagate(e), or an explicit match?", "q", [
    {"try_": f"{pre}{sig}\n    x = try_({x})\n    y = try_({y})\n    return {use}\n",
     "q": f"{pre}{sig}\n    x = {x}?\n    y = {y}?\n    return {use}\n",
     "propagate": f"{pre}{sig}\n    x = propagate({x})\n    y = propagate({y})\n    return {use}\n",
     "match": f"{pre}{sig}\n    match {x}:\n        case Err(e):\n            return Err(e)\n        case Ok(x):\n            pass\n"
              f"    match {y}:\n        case Err(e):\n            return Err(e)\n        case Ok(y):\n            pass\n    return {use}\n"}
    for pre, sig, x, y, use in _TRY])

# 7. match whose value is returned -----------------------------------------------------------------
_M = [
    ("def apply(balance: int, op: Op) -> int:", "op",
     [("Deposit(amount)", "balance + amount"), ("Withdraw(amount)", "balance - amount")]),
    ("def describe(s: Shape) -> str:", "s", [("Circle(r)", 'f"circle {r}"'), ("Rect(w, h)", 'f"rect {w}x{h}"'), ("_", '"other"')]),
    ("def code(r: Result[int, str]) -> int:", "r", [("Ok(n)", "n"), ("Err(_)", "-1")]),
]


def _match(sig, subj, arms, form):
    s = sig + "\n"
    if form == "block":
        return s + f"    match {subj}:\n" + "".join(f"        case {p}:\n            return {e}\n" for p, e in arms)
    if form == "oneline":
        return s + f"    match {subj}:\n" + "".join(f"        case {p}: return {e}\n" for p, e in arms)
    if form == "expr":
        return s + f"    return match {subj}:\n" + "".join(f"        case {p}: {e}\n" for p, e in arms)
    return s + f"    return match {subj} {{\n" + "".join(f"        {p} => {e},\n" for p, e in arms) + "    }\n"


construct("match-form", "Match whose value is returned: case blocks, one-line cases, a `return match` expression, or Canon arrows?",
          "block", [{f: _match(*c, f) for f in ("block", "oneline", "expr", "arrow")} for c in _M])

# 7b. two-way choice on a Bool ---------------------------------------------------------------------
_COND = [
    ("def parity(n: int) -> str:", "n % 2 == 0", '"even"', '"odd"'),
    ("def fee(total: float, member: bool) -> float:", "member", "0.0", "total * 0.05"),
    ("def sign(n: int) -> int:", "n < 0", "-1", "1"),
]
construct("bool-match", "A value chosen by a Bool: `a if c else b`, or a match on True/False?", "conditional", [
    {"conditional": f"{sig}\n    return {a} if {c} else {b}\n",
     "match": f"{sig}\n    match {c}:\n        case True:\n            return {a}\n        case False:\n            return {b}\n"}
    for sig, c, a, b in _COND])

# 8. lambdas -------------------------------------------------------------------------------------
_LAM = [
    (ITEM, "def in_stock(items: list[Item]) -> list[Item]:", "filter(items, @L)", "i", "i.qty > 0"),
    ("", "def doubled(xs: list[int]) -> list[int]:", "map(xs, @L)", "x", "x * 2"),
    ("", "def total(xs: list[int]) -> int:", "fold(xs, 0, @L)", "acc, x", "acc + x"),
]
construct("lambda", "Lambdas: `lambda x: e` or `|x| e`?", "lambda", [
    {"lambda": f"{pre}{sig}\n    return " + fill(body, L=f"lambda {ps}: {e}") + "\n",
     "bars": f"{pre}{sig}\n    return " + fill(body, L=f"|{ps}| {e}") + "\n"} for pre, sig, body, ps, e in _LAM])

# 9. pipelines -------------------------------------------------------------------------------------
_PIPE = [
    (ITEM, "def cheapest(items: list[Item], k: int) -> list[str]:",
     "map(take(sort_by(filter(items, lambda i: i.qty > 0), lambda i: i.price), k), lambda i: i.sku)",
     "items\n        |> filter(lambda i: i.qty > 0)\n        |> sort_by(lambda i: i.price)\n        |> take(k)\n        |> map(lambda i: i.sku)",
     ["in_stock = filter(items, lambda i: i.qty > 0)", "by_price = sort_by(in_stock, lambda i: i.price)", "top = take(by_price, k)"],
     "map(top, lambda i: i.sku)"),
    ("", "def reverse_words(s: str) -> str:", 'join(reverse(split(s, " ")), " ")',
     's\n        |> split(" ")\n        |> reverse()\n        |> join(" ")',
     ['words = split(s, " ")', "backwards = reverse(words)"], 'join(backwards, " ")'),
    ("", "def squares_of_evens(xs: list[int]) -> int:", "sum(map(filter(xs, lambda x: x % 2 == 0), lambda x: x * x))",
     "xs\n        |> filter(lambda x: x % 2 == 0)\n        |> map(lambda x: x * x)\n        |> sum()",
     ["evens = filter(xs, lambda x: x % 2 == 0)", "squares = map(evens, lambda x: x * x)"], "sum(squares)"),
]
construct("pipeline", "Three or more chained calls: nested calls, a `|>` pipeline, or named steps?", "nested", [
    {"nested": f"{pre}{sig}\n    return {nested}\n", "pipeline": f"{pre}{sig}\n    return {pipe}\n",
     "steps": f"{pre}{sig}\n" + "".join(f"    {s}\n" for s in steps) + f"    return {last}\n"}
    for pre, sig, nested, pipe, steps, last in _PIPE])

# 10. bindings -----------------------------------------------------------------------------------
_BIND = [
    "def mean(xs: list[float]) -> float:\n    @Ln = to_float(len(xs))\n    @Vtotal = 0.0\n    for x in xs:\n"
    "        total += x\n    return total / n\n",
    "def word_count(text: str) -> int:\n    @Lwords = split(trim(text), \" \")\n    @Vcount = 0\n    for w in words:\n"
    "        if w != \"\":\n            count += 1\n    return count\n",
    "def fib(n: int) -> int:\n    @Va = 0\n    @Vb = 1\n    for i in range(0, n):\n        @Lnext = a + b\n        a = b\n"
    "        b = next\n    return a\n",
]
construct("bindings", "Local bindings: bare `x = e` (mutability inferred), `let`/`var`, or `x: Final = e` for immutables?",
          "bare", [{"bare": fill(s, L="", V=""), "letvar": fill(s, L="let ", V="var "),
                    "final": re.sub(r"@L(\w+) =", r"\1: Final =", s).replace("@V", "")} for s in _BIND])

# 11. augmented assignment -----------------------------------------------------------------------
_AUG = [
    ("def total(xs: list[int]) -> int:\n    t = 0\n    for x in xs:\n        @A\n    return t\n", "t += x", "t = t + x"),
    ("def countdown(n: int) -> list[int]:\n    out = []\n    i = n\n    while i > 0:\n        out = append(out, i)\n"
     "        @A\n    return out\n", "i -= 1", "i = i - 1"),
    ("def shout(words: list[str]) -> str:\n    s = \"\"\n    for w in words:\n        @A\n    return s\n",
     's += w + "!"', 's = s + w + "!"'),
]
construct("augmented", "Updating a variable: `x += e` or `x = x + e`?", "augmented", [
    {"augmented": fill(s, A=a), "plain": fill(s, A=b)} for s, a, b in _AUG])

# 12. mutating a parameter -----------------------------------------------------------------------
_PARAM = [
    ("def digit_sum(n: int) -> int:", "n",
     "    total = 0\n    while @V > 0:\n        total += @V % 10\n        @V = @V / 10\n    return total\n"),
    ("def collatz_steps(n: int) -> int:", "n",
     "    steps = 0\n    while @V != 1:\n        if @V % 2 == 0:\n            @V = @V / 2\n        else:\n"
     "            @V = 3 * @V + 1\n        steps += 1\n    return steps\n"),
    ("def gcd(a: int, b: int) -> int:", "b", "    x = a\n    while @V != 0:\n        t = @V\n        @V = x % @V\n        x = t\n    return x\n"),
]
construct("param-mutation", "Changing a parameter's value: assign to it directly, or copy it into a local first?", "direct", [
    {"direct": f"{sig}\n" + fill(body, V=v), "copy": f"{sig}\n    m = {v}\n" + fill(body, V="m")} for sig, v, body in _PARAM])

# 13. holes ----------------------------------------------------------------------------------------
_HOLE = [
    ("", "def score(xs: list[int]) -> int:", "    best = @H\n    return best * 2\n"),
    ("", "def label(n: int) -> str:", "    if n > 100:\n        return \"big\"\n    return @H\n"),
    (ITEM, "def pick(items: list[Item]) -> Option[Item]:", "    in_stock = filter(items, lambda i: i.qty > 0)\n    return @H\n"),
]
construct("holes", "A hole (\"fill this in\"): `...`, `?`, `hole()` or `todo()`?", "ellipsis", [
    {n: f"{pre}{sig}\n" + fill(body, H=sp) for n, sp in (("ellipsis", "..."), ("q", "?"), ("hole", "hole()"), ("todo", "todo()"))}
    for pre, sig, body in _HOLE])

# 14. type names -----------------------------------------------------------------------------------
_PY = {"List": "list", "Float": "float", "Int": "int", "String": "str", "Bool": "bool", "Unit": "None", "Map": "dict"}
_TYPES = [
    "def mean(xs: @List[@Float]) -> @Float:\n    return sum_float(xs) / to_float(len(xs))\n\n\n"
    "def label(n: @Int, unit: @String) -> @String:\n    return f\"{n} {unit}\"\n",
    "@effects(io)\ndef report(names: @List[@String], verbose: @Bool) -> @Unit:\n    for n in names:\n        print(n)\n",
    "def index(words: @List[@String]) -> @Map[@String, @Int]:\n    return map_from(zip(words, range(0, len(words))))\n\n\n"
    "def lookup(m: @Map[@String, @Int], k: @String) -> Option[@Int]:\n    return map_get(m, k)\n",
]
construct("type-names", "Type names: Python's (int, str, list[T], dict[K, V], None) or Canon's (Int, String, List[T], Map[K, V], Unit)?",
          "python", [{"python": re.sub(r"@(List|Float|Int|String|Bool|Unit|Map)\b", lambda m: _PY[m.group(1)], s), "canon": re.sub(r"@(List|Float|Int|String|Bool|Unit|Map)\b", r"\1", s)}
                     for s in _TYPES])

# 15. function types -------------------------------------------------------------------------------
_FT = [
    ("def apply_twice(f: @F, x: int) -> int:\n    return f(f(x))\n", "Callable[[int], int]", "fn(int) -> int"),
    ("def keep(xs: list[str], pred: @F) -> list[str]:\n    return filter(xs, pred)\n", "Callable[[str], bool]", "fn(str) -> bool"),
    ("def combine(xs: list[int], f: @F) -> int:\n    return fold(xs, 0, f)\n", "Callable[[int, int], int]", "fn(int, int) -> int"),
]
construct("fn-types", "Function types: `Callable[[A], B]` or `fn(A) -> B`?", "callable",
          [{"callable": fill(s, F=a), "fn": fill(s, F=b)} for s, a, b in _FT])

# 16. strings --------------------------------------------------------------------------------------
_STR = [
    ("", "def greet(name: str, n: int) -> str:", 'f"hello {name}, you have {n} messages"',
     '"hello " + name + ", you have " + to_string(n) + " messages"', '"hello " + name + ", you have " + str(n) + " messages"'),
    (ITEM, "def row(item: Item) -> str:", 'f"{item.sku}: {item.qty} x {item.price}"',
     'item.sku + ": " + to_string(item.qty) + " x " + to_string(item.price)', 'item.sku + ": " + str(item.qty) + " x " + str(item.price)'),
    ("", "def progress(done: int, total: int) -> str:", 'f"{done}/{total} done"',
     'to_string(done) + "/" + to_string(total) + " done"', 'str(done) + "/" + str(total) + " done"'),
]
construct("strings", "Building strings: f-strings, `+` with to_string, or `+` with str()?", "fstring", [
    {"fstring": f"{pre}{sig}\n    return {a}\n", "plus": f"{pre}{sig}\n    return {b}\n", "plus-str": f"{pre}{sig}\n    return {c}\n"}
    for pre, sig, a, b, c in _STR])

# 17. tests ----------------------------------------------------------------------------------------
_TEST = [
    ("def add(a: int, b: int) -> int:\n    return a + b\n\n\n", "adds two numbers", "    assert add(2, 3) == 5\n"),
    ("def is_even(n: int) -> bool:\n    return n % 2 == 0\n\n\n", "even and odd", "    assert is_even(4)\n    assert not is_even(7)\n"),
    ("def clamp(x: int, lo: int, hi: int) -> int:\n    return max(lo, min(x, hi))\n\n\n", "clamps to range",
     "    assert clamp(15, 0, 10) == 10\n    assert clamp(-3, 0, 10) == 0\n"),
]
construct("tests", "Test blocks: `def test_name() -> None:` (pytest), `@test(\"name\")` on a def, or `test \"name\":`?", "pytest", [
    {"pytest": f"{pre}def test_{name.replace(' ', '_')}() -> None:\n{body}",
     "decorator": f"{pre}@test(\"{name}\")\ndef _() -> None:\n{body}",
     "canon": f"{pre}test \"{name}\":\n{body}"} for pre, name, body in _TEST])

# 18. membership -----------------------------------------------------------------------------------
_IN = [
    ("def allowed(user: str, admins: list[str]) -> bool:\n    return @X\n", "user", "admins"),
    (ITEM + "def banned_count(items: list[Item], banned: list[str]) -> int:\n    n = 0\n    for i in items:\n"
     "        if @X:\n            n += 1\n    return n\n", "i.sku", "banned"),
    ("def dedupe(xs: list[int]) -> list[int]:\n    out = []\n    for x in xs:\n        if not @X:\n"
     "            out = append(out, x)\n    return out\n", "x", "out"),
]
construct("membership", "Membership: `x in xs` or `contains(xs, x)`?", "in", [
    {"in": fill(s, X=f"{x} in {xs}"), "contains": fill(s, X=f"contains({xs}, {x})")} for s, x, xs in _IN])

# 19. tuple slots ----------------------------------------------------------------------------------
_TUP = [
    "def swap(p: tuple[int, str]) -> tuple[str, int]:\n    return (p@1, p@0)\n",
    "def best(scores: list[tuple[str, int]]) -> str:\n    top = (\"\", 0)\n    for s in scores:\n        if s@1 > top@1:\n"
    "            top = s\n    return top@0\n",
    "def total(pairs: list[tuple[str, float]]) -> float:\n    t = 0.0\n    for p in pairs:\n        t += p@1\n    return t\n",
]
construct("tuple-slots", "Tuple slots: `t[0]` or `t.0`?", "index", [
    {"index": re.sub(r"@(\d)", r"[\1]", s), "dot": re.sub(r"@(\d)", r".\1", s)} for s in _TUP])

# 20. boolean literals ------------------------------------------------------------------------------
_BOOL = [
    "def any_negative(xs: list[int]) -> bool:\n    for x in xs:\n        if x < 0:\n            return @T\n    return @F\n",
    "@effects(io)\ndef main() -> None:\n    done = @F\n    while not done:\n        line = read_line()\n        done = line is None\n",
    "def flags(n: int) -> list[bool]:\n    return [n > 0, @T, @F]\n",
]
construct("bool-literals", "Boolean literals: True/False or true/false?", "python", [
    {"python": fill(s, T="True", F="False"), "lower": fill(s, T="true", F="false")} for s in _BOOL])

# 21. None tests -----------------------------------------------------------------------------------
_NONE = [
    "def has_name(name: Option[str]) -> bool:\n    return name @IS None\n",
    "@effects(io)\ndef echo() -> None:\n    line = read_line()\n    while line @NOT None:\n        print(unwrap_or(line, \"\"))\n"
    "        line = read_line()\n",
    "def first_or_zero(xs: list[int]) -> int:\n    f = first(xs)\n    if f @IS None:\n        return 0\n    return unwrap_or(f, 0)\n",
]
construct("none-test", "Testing for None: `x is None` or `x == None`?", "is", [
    {"is": fill(s, IS="is", NOT="is not"), "eq": fill(s, IS="==", NOT="!=")} for s in _NONE])

# 22. indentation width, and the re-tests in a Python-shaped program ---------------------------------
_SHAPED = [
    fill(_LOGIC[0][0], X="i.qty > 0 and i.sku not in banned"),
    "def isqrt(n: int) -> int:\n    r = 0\n    while (r + 1) * (r + 1) <= n:\n        r += 1\n    return r\n",
    _match(*_M[0], "block"),
]


def _two_spaces(s):
    return "\n".join(" " * ((len(l) - len(l.lstrip(" "))) // 2) + l.lstrip(" ") for l in s.split("\n"))


def _braces(src):
    out, stack = [], []
    for line in src.rstrip("\n").split("\n"):
        ind = len(line) - len(line.lstrip(" "))
        while stack and line.strip() and ind <= stack[-1]:
            out.append(" " * stack.pop() + "}")
        s = line.rstrip()
        if s.endswith(":") and not s.lstrip().startswith(("@", "#")):
            out.append(s[:-1] + " {")
            stack.append(ind)
        else:
            out.append(s)
    while stack:
        out.append(" " * stack.pop() + "}")
    return "\n".join(out) + "\n"


construct("indent-width", "Indentation: 4 spaces or 2?", "four", [{"four": s, "two": _two_spaces(s)} for s in _SHAPED])
construct("blocks-retest", "Re-test in a Python-shaped program: colon + indentation, or braces?", "indent",
          [{"indent": s, "braces": _braces(s)} for s in _SHAPED])
construct("def-retest", "Re-test in a Python-shaped program: `def` or `fn`?", "def",
          [{"def": s, "fn": "\n".join(("fn " + l[4:]) if l.startswith("def ") else l for l in s.split("\n"))} for s in _SHAPED])

# 23. blank lines between top-level definitions --------------------------------------------------------
_BL = [
    ITEM + "def total(items: list[Item]) -> float:\n    return sum_float(map(items, lambda i: i.price))\n",
    "def add(a: int, b: int) -> int:\n    return a + b\n\n\ndef double(x: int) -> int:\n    return add(x, x)\n",
    "def make(sku: str) -> Item:\n    return Item(sku=sku, qty=1, price=0.0)\n\n\ndef make_two() -> list[Item]:\n"
    "    return [make(\"a\"), make(\"b\")]\n",
]
construct("blank-lines", "Blank lines between top-level definitions: two (PEP 8) or one?", "one",
          [{"two": s, "one": s.replace("\n\n\n", "\n\n")} for s in _BL])

# 24. Option spelling ----------------------------------------------------------------------------------
_OPT = [
    "def first_even(xs: list[int]) -> @O[int]:\n    for x in xs:\n        if x % 2 == 0:\n            return Some(x)\n    return None\n",
    "def find(users: list[str], name: str) -> @O[str]:\n    for u in users:\n        if u == name:\n            return Some(u)\n    return None\n",
    "def parse_age(s: str) -> @O[int]:\n    return parse_int(trim(s))\n",
]
construct("option-type", "Option type (values stay Some(x)/None): `Option[T]` or `T | None`?", "option", [
    {"option": re.sub(r"@O\[(\w+)\]", r"Option[\1]", s), "union": re.sub(r"@O\[(\w+)\]", r"\1 | None", s)} for s in _OPT])

# 25. effects on function types (owner's addition: close the higher-order effect leak) ---------------
_FTE = [
    ("@effects(io)\ndef each(xs: list[str], f: @F) -> None:\n    for x in xs:\n        f(x)\n\n\n"
     "@effects(io)\ndef main() -> None:\n    each([\"a\", \"b\"], print)\n", "[str]", "None", "io"),
    ("@effects(net)\ndef fetch_all(urls: list[str], get: @F) -> list[Result[str, Error]]:\n"
     "    return map(urls, get)\n", "[str]", "Result[str, Error]", "net"),
    ("@effects(io, time)\ndef timed(label: str, work: @F) -> int:\n    start = now()\n    work()\n"
     "    print(f\"{label}: {now() - start} ms\")\n    return now() - start\n", "[]", "None", "io, time"),
]


def _fte(args, ret, e, form):
    if form == "callable-extra":
        return f"Callable[{args}, {ret}, {e.replace(', ', ' | ')}]"
    if form == "effects-wrap":
        return f"Effects[Callable[{args}, {ret}], {e.replace(', ', ' | ')}]"
    if form == "annotated":
        return f"Annotated[Callable[{args}, {ret}], effects({e})]"
    return f"Callable[{args}, Effect[{ret}, {e.replace(', ', ' | ')}]]"


construct("fn-type-effects", "Effects in a function type: `Callable[[A], B, io]`, `Effects[Callable[[A], B], io]`, "
          "`Annotated[Callable[[A], B], effects(io)]`, or `Callable[[A], Effect[B, io]]`?", "callable-extra", [
              {f: fill(s, F=_fte(a, r, e, f)) for f in ("callable-extra", "effects-wrap", "annotated", "ret-wrap")}
              for s, a, r, e in _FTE])


def programs(c):
    """Yield (context index, variant, text)."""
    for ci, ctx in enumerate(c["contexts"]):
        for name, text in ctx.items():
            yield ci, name, text


if __name__ == "__main__":
    import sys
    want = sys.argv[1] if len(sys.argv) > 1 else None
    for c in CONSTRUCTS:
        if want and c["id"] != want:
            continue
        for ci, name, text in programs(c):
            if ci == 0 or want:
                print(f"===== {c['id']} [{ci}] / {name}\n{text}")
