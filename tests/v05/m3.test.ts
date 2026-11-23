/**
 * v0.5 M3 acceptance: the FastAPI backend. Golden files for the worked example; ruff and
 * mypy --strict on generated code; HTTP behaviour (200, 400, 422, 500) for every endpoint shape;
 * SQLite tables; effects as parameters.
 */
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildBackend, loadProject, py, run } from "./helpers/py";

const golden = join(__dirname, "golden", "todos");
const shop = join(__dirname, "projects", "shop");

const PRELUDE = `
import json, os, tempfile
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "canon.db")
from fastapi.testclient import TestClient
from main import app
c = TestClient(app, raise_server_exceptions=False)
def call(method, path, **kw):
    r = c.request(method, path, **kw)
    return [r.status_code, r.json()]
`;

let todosDir = "";
let shopDir = "";
beforeAll(() => {
  todosDir = buildBackend(loadProject(golden));
  shopDir = buildBackend(loadProject(shop));
});

describe("generated Python passes the linters and the type checker", () => {
  for (const [name, dir] of [["the worked example", () => todosDir], ["the shop (three modules)", () => shopDir]] as const) {
    it(`${name}: ruff format --check, ruff check and mypy --strict`, () => {
      const fmt = run("ruff", ["format", "--isolated", "--check", "--diff", "canon_generated", "main.py"], dir());
      expect(fmt.code, fmt.out + fmt.err).toBe(0);
      const lint = run("ruff", ["check", "--isolated", "--output-format", "concise", "canon_generated", "main.py"], dir());
      expect(lint.code, lint.out + lint.err).toBe(0);
      const types = run("mypy", ["--strict", "canon_generated", "main.py"], dir());
      expect(types.code, types.out + types.err).toBe(0);
    }, 120_000);
  }
});

describe("HTTP: the worked example", () => {
  it("200, 400 and 422 with {\"error\": ...} bodies", () => {
    const r = py(todosDir, PRELUDE + `
out = {}
out["create"] = call("POST", "/todos", json={"title": "  milk "})
out["blank"] = call("POST", "/todos", json={"title": "  "})
out["malformed"] = call("POST", "/todos", json={"name": "x"})
out["complete"] = call("POST", "/todos/1/complete")
out["missing"] = call("POST", "/todos/9/complete")
out["list"] = call("GET", "/todos", params={"page": 1, "per_page": 10})
out["bad_page"] = call("GET", "/todos", params={"page": 0, "per_page": 10})
out["no_query"] = call("GET", "/todos")
print(json.dumps(out))
`) as Record<string, [number, unknown]>;
    expect(r.create).toEqual([200, { id: 1, title: "milk", done: false }]);
    expect(r.blank).toEqual([422, { error: { kind: "ValidationError", rule: "str_len(trim(input.title)) > 0" } }]);
    expect(r.malformed).toEqual([422, { error: { kind: "ValidationError", rule: "title: Field required" } }]);
    expect(r.complete).toEqual([200, { id: 1, title: "milk", done: true }]);
    expect(r.missing).toEqual([400, { error: { kind: "NotFound", id: 9 } }]);
    expect(r.list).toEqual([200, [{ id: 1, title: "milk", done: true }]]);
    expect(r.bad_page).toEqual([422, { error: { kind: "ValidationError", rule: "page >= 1 && per_page >= 1 && per_page <= 100" } }]);
    expect(r.no_query[0]).toBe(422);
  });
});

describe("HTTP: every endpoint shape (the shop)", () => {
  let r: Record<string, [number, unknown]>;
  beforeAll(() => {
    r = py(shopDir, PRELUDE + `
import canon_generated.api as api
from canon_generated.net import Http
from canon_generated.runtime import Ok
class FakePayments(Http):
    def post(self, url, body):
        return Ok("receipt-" + body)
dep = api.PaymentsExampleCom.__metadata__[0].dependency
app.dependency_overrides[dep] = lambda: FakePayments("payments.example.com")
apple = {"sku": "apple", "name": "Apple", "cents": 105, "stock": 3, "tags": ["fruit"]}
hammer = {"sku": "hammer", "name": "Hammer", "cents": 1999, "stock": 1, "tags": ["tool", "heavy"]}
out = {}
# a body: 200, 400 (Err), 422 (requires, malformed)
out["add"] = call("POST", "/products", json=apple)
out["add_again"] = call("POST", "/products", json=apple)
out["add_short_sku"] = call("POST", "/products", json={**hammer, "sku": "ha"})
out["add_wrong_type"] = call("POST", "/products", json={**hammer, "cents": "cheap"})
out["add_too_big"] = call("POST", "/products", json={**hammer, "cents": 2**60})
call("POST", "/products", json=hammer)
# a path parameter: 200 and 400
out["get"] = call("GET", "/products/apple")
out["get_missing"] = call("GET", "/products/pear")
# query parameters with an Option: 200 and 422
out["list_all"] = call("GET", "/products", params={"page": 1, "per_page": 10})
out["list_tag"] = call("GET", "/products", params={"tag": "tool", "page": 1, "per_page": 10})
out["list_page2"] = call("GET", "/products", params={"page": 2, "per_page": 1})
out["list_bad"] = call("GET", "/products", params={"page": 1, "per_page": 99})
# a path parameter and a body (PATCH), with try: 200, 400, 422, 500 (overflow caught on the way out)
out["restock"] = call("PATCH", "/products/apple/stock", json={"amount": 2})
out["restock_missing"] = call("PATCH", "/products/pear/stock", json={"amount": 2})
out["restock_zero"] = call("PATCH", "/products/apple/stock", json={"amount": 0})
call("PATCH", "/products/hammer/stock", json={"amount": 2**53 - 3})
out["restock_overflow"] = call("PATCH", "/products/hammer/stock", json={"amount": 2**53 - 1})
out["after_overflow"] = call("GET", "/products/hammer")
# plain returns: a Map, a Bool, and a trap (division by zero) as 500
out["prices"] = call("GET", "/prices")
out["average"] = call("GET", "/average", params={"skus": "apple,hammer"})
out["average_none"] = call("GET", "/average", params={"skus": "pear"})
# accounts: hashing, uuid, typed errors without fields
out["signup"] = call("POST", "/users", json={"email": "ada@example.com", "name": " Ada ", "password": "correct horse"})
out["signup_taken"] = call("POST", "/users", json={"email": "ada@example.com", "name": "Ada", "password": "correct horse"})
out["signup_bad_email"] = call("POST", "/users", json={"email": "ada", "name": "Ada", "password": "correct horse"})
out["login"] = call("POST", "/login", json={"email": "ada@example.com", "name": "", "password": "correct horse"})
out["login_wrong"] = call("POST", "/login", json={"email": "ada@example.com", "name": "", "password": "wrong"})
out["rename"] = call("PUT", "/users/ada@example.com", json={"email": "x", "name": "Ada L."})
# orders across modules: try inside a loop, a net host handed in as a parameter, group_by and fold
out["order"] = call("POST", "/orders", json={"email": "ada@example.com", "lines": [{"sku": "apple", "quantity": 2}, {"sku": "hammer", "quantity": 1}]})
out["order_missing"] = call("POST", "/orders", json={"email": "ada@example.com", "lines": [{"sku": "pear", "quantity": 1}]})
out["order_empty"] = call("POST", "/orders", json={"email": "ada@example.com", "lines": []})
out["pay"] = call("POST", "/orders/1/pay")
out["pay_missing"] = call("POST", "/orders/7/pay")
call("POST", "/orders", json={"email": "bob@example.com", "lines": [{"sku": "apple", "quantity": 1}]})
out["summaries"] = call("GET", "/summaries")
out["open"] = call("GET", "/orders/open", params={"email": "bob@example.com"})
out["customers"] = call("GET", "/customers")
out["first"] = call("GET", "/orders/first")
out["delete"] = call("DELETE", "/products/apple")
out["delete_again"] = call("DELETE", "/products/apple")
print(json.dumps(out))
`) as Record<string, [number, unknown]>;
  });

  it("a JSON body: 200, 400 for Err, 422 for requires and for a malformed body", () => {
    expect(r.add).toEqual([200, { sku: "apple", name: "Apple", cents: 105, stock: 3, tags: ["fruit"] }]);
    expect(r.add_again).toEqual([400, { error: { kind: "Invalid", reason: "duplicate sku apple" } }]);
    expect(r.add_short_sku).toEqual([422, { error: { kind: "ValidationError", rule: "str_len(input.sku) >= 3 && input.cents >= 0 && input.stock >= 0" } }]);
    expect(r.add_wrong_type[0]).toBe(422);
    expect((r.add_wrong_type[1] as { error: { rule: string } }).error.rule).toMatch(/^cents: /);
    expect(r.add_too_big[0]).toBe(422); // SafeInt: Canon's Int is 53 bits
  });

  it("a path parameter: 200 and 400", () => {
    expect(r.get[0]).toBe(200);
    expect(r.get_missing).toEqual([400, { error: { kind: "Missing", sku: "pear" } }]);
  });

  it("query parameters, including an omitted Option: 200 and 422", () => {
    expect((r.list_all[1] as { sku: string }[]).map((p) => p.sku)).toEqual(["apple", "hammer"]);
    expect((r.list_tag[1] as { sku: string }[]).map((p) => p.sku)).toEqual(["hammer"]);
    expect((r.list_page2[1] as { sku: string }[]).map((p) => p.sku)).toEqual(["hammer"]);
    expect(r.list_bad[0]).toBe(422);
  });

  it("a path parameter with a body, through try: 200, 400, 422, and 500 for a trap", () => {
    expect((r.restock as [number, { stock: number }])[1].stock).toBe(5);
    expect(r.restock_missing).toEqual([400, { error: { kind: "Missing", sku: "pear" } }]);
    expect(r.restock_zero[0]).toBe(422);
    expect(r.restock_overflow).toEqual([500, { error: { kind: "InternalError" } }]);
    expect((r.after_overflow as [number, { stock: number }])[1].stock).toBe(2 ** 53 - 2); // nothing was saved
  });

  it("plain returns: a map, a Bool, and division by zero as 500", () => {
    expect(r.prices).toEqual([200, { apple: "$1.05", hammer: "$19.99" }]);
    expect(r.average).toEqual([200, 1052]);
    expect(r.average_none).toEqual([500, { error: { kind: "InternalError" } }]);
    expect(r.delete).toEqual([200, true]);
    expect(r.delete_again).toEqual([200, false]);
  });

  it("accounts: hashed passwords, typed errors with and without fields", () => {
    expect(r.signup).toEqual([200, { email: "ada@example.com", name: "Ada" }]);
    expect(r.signup_taken).toEqual([400, { error: { kind: "Taken", email: "ada@example.com" } }]);
    expect(r.signup_bad_email[0]).toBe(422);
    expect(r.login).toEqual([200, { email: "ada@example.com", name: "Ada" }]);
    expect(r.login_wrong).toEqual([400, { error: { kind: "BadLogin" } }]);
    expect(r.rename).toEqual([200, { email: "ada@example.com", name: "Ada L." }]);
  });

  it("orders across modules: try in a loop, a host handed in, group_by and fold, Options", () => {
    expect(r.order).toEqual([200, {
      id: 1, email: "ada@example.com", lines: [{ sku: "apple", quantity: 2 }, { sku: "hammer", quantity: 1 }],
      total: 2 * 105 + 1999, status: { kind: "Open" },
    }]);
    expect(r.order_missing).toEqual([400, { error: { kind: "Missing", sku: "pear" } }]);
    expect(r.order_empty[0]).toBe(422);
    expect((r.pay[1] as { status: unknown }).status).toEqual({ kind: "Paid", receipt: "receipt-2209" });
    expect(r.pay_missing).toEqual([400, { error: { kind: "Missing", sku: "order 7" } }]);
    expect(r.summaries).toEqual([200, [
      { email: "ada@example.com", orders: 1, spent: 2209 },
      { email: "bob@example.com", orders: 1, spent: 105 },
    ]]);
    expect(r.open).toEqual([200, 1]);
    expect(r.customers).toEqual([200, [["Ada L.", 2]]]);
    expect(r.first).toEqual([200, "ada@example.com"]);
  });
});

describe("SQLite tables", () => {
  it("persist across requests and app restarts, and start empty with a new database", () => {
    const r = py(todosDir, `
import json, os, tempfile
db = os.path.join(tempfile.mkdtemp(), "canon.db")
os.environ["CANON_DATABASE"] = db
from fastapi.testclient import TestClient
from main import app
from canon_generated import store
c = TestClient(app)
c.post("/todos", json={"title": "a"})
c.post("/todos", json={"title": "b"})
store.reset()  # as if the server restarted
after_restart = [t["title"] for t in TestClient(app).get("/todos", params={"page": 1, "per_page": 10}).json()]
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "fresh.db")
store.reset()
fresh = TestClient(app).get("/todos", params={"page": 1, "per_page": 10}).json()
print(json.dumps({"after_restart": after_restart, "fresh": fresh, "file": os.path.exists(db)}))
`);
    expect(r).toEqual({ after_restart: ["a", "b"], fresh: [], file: true });
  });

  it("insert of a duplicate key traps (R007), save replaces in place, next_id and count", () => {
    const r = py(todosDir, `
import json, os, tempfile
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "canon.db")
from canon_generated.store import open_table
from canon_generated.models import Todo
from canon_generated.runtime import Trap
t = open_table("todos", Todo)
t.insert(Todo(id=1, title="a", done=False))
t.insert(Todo(id=2, title="b", done=False))
try:
    t.insert(Todo(id=1, title="c", done=False))
    dup = None
except Trap as e:
    dup = str(e)
t.save(Todo(id=1, title="A", done=True))
print(json.dumps({"dup": dup, "titles": [x.title for x in t.scan()], "next": t.next_id(), "count": t.count(),
  "deleted": t.delete(2), "again": t.delete(2), "get": t.get(1).title, "none": t.get(9)}))
`);
    expect(r).toEqual({ dup: "R007: duplicate key 1 in table todos", titles: ["A", "b"], next: 3, count: 2, deleted: true, again: false, get: "A", none: null });
  });

  it("a changed row type resets its table (no migrations in v0.5)", () => {
    const r = py(todosDir, `
import json, os, tempfile, sqlite3
db = os.path.join(tempfile.mkdtemp(), "canon.db")
con = sqlite3.connect(db)
con.execute("CREATE TABLE canon_tables (name TEXT PRIMARY KEY, schema TEXT)")
con.execute("INSERT INTO canon_tables VALUES ('todos', 'an older schema')")
con.execute('CREATE TABLE "todos" (pos INTEGER PRIMARY KEY AUTOINCREMENT, key UNIQUE, row TEXT)')
con.execute('INSERT INTO "todos" (key, row) VALUES (1, \\'{"id": 1, "name": "old"}\\')')
con.commit()
os.environ["CANON_DATABASE"] = db
from canon_generated.store import open_table
from canon_generated.models import Todo
print(json.dumps(open_table("todos", Todo).count()))
`);
    expect(r).toBe(0);
  });
});

describe("effects become parameters", () => {
  it("each logic function receives only the tables and hosts its Canon effects name", () => {
    const r = py(shopDir, `
import inspect, json
from canon_generated import catalog, orders, users
sig = lambda f: list(inspect.signature(f).parameters)
print(json.dumps({
  "add_product": sig(catalog.add_product), "price_label": sig(catalog.price_label),
  "find": sig(catalog.find), "signup": sig(users.signup), "profile": sig(users.profile),
  "place_order": sig(orders.place_order), "line_total": sig(orders.line_total), "pay": sig(orders.pay),
  "customers": sig(orders.customers),
}))
`);
    expect(r).toEqual({
      add_product: ["input", "products"], price_label: ["cents"], find: ["sku", "products"],
      signup: ["input", "users"], profile: ["u"], place_order: ["input", "orders", "products"],
      line_total: ["l", "products"], pay: ["id", "orders", "payments_example_com"], customers: ["orders", "users"],
    });
  });

  it("a host client refuses any other host (R006)", () => {
    const r = py(shopDir, `
import json
from canon_generated.net import Http
from canon_generated.runtime import Trap
try:
    Http("payments.example.com").get("https://evil.example.com/steal")
    out = None
except Trap as e:
    out = str(e)
print(json.dumps(out))
`);
    expect(r).toBe("R006: effect net(evil.example.com) denied: this function may call only payments.example.com");
  });
});

describe("the Python runtime files", () => {
  it("are embedded from packages/compiler/py exactly (pnpm embed-py)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { PY_RUNTIME } = await import("@canon/compiler");
    const dir = join(__dirname, "..", "..", "packages", "compiler", "py");
    const files = readdirSync(dir).filter((f) => f.endsWith(".py")).sort();
    expect(Object.keys(PY_RUNTIME).sort()).toEqual(files);
    for (const f of files) expect(PY_RUNTIME[f], f).toBe(readFileSync(join(dir, f), "utf8"));
  });

  it("stay under 250 lines each", async () => {
    const { PY_RUNTIME } = await import("@canon/compiler");
    for (const [f, text] of Object.entries(PY_RUNTIME)) expect(text.split("\n").length, f).toBeLessThan(250);
  });
});

describe("G002: what the Python target cannot express", () => {
  it("an Option of an Option, reported at the function", async () => {
    const { checkProject, generateFastapi, TargetError } = await import("@canon/compiler");
    const src = "fn f(xs: List[Option[Int]]) -> Bool {\n  return is_some(first(xs))\n}\n";
    const p = checkProject([{ name: "m", path: "canon/m.cn", src }]);
    expect(p.ok).toBe(true);
    let err: unknown = null;
    try {
      generateFastapi(p);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TargetError);
    expect((err as InstanceType<typeof TargetError>).diagnostics[0].diagnostic.message).toMatch(/G?an Option of an Option .*\(fn f\)/);
  });
});

describe("CB-1: no temporaries hoisted out of lambdas or loop conditions (found by CanonBench)", () => {
  it("unwrap_or in a lambda, a comprehension and a while condition gives the JavaScript runtime's results", async () => {
    const { checkProject, compileJs, fmt, generateFastapi } = await import("@canon/compiler");
    const { MemoryHost, Runtime, load, testHost } = await import("@canon/runtime");
    const { mkdirSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const src = fmt(`fn to_ints(xs: List[String]) -> List[Int] {
  return map(xs, |p| unwrap_or(parse_int(p), 0))
}

fn strip_x(xs: List[String]) -> Int {
  var out = xs
  var n = 0
  while len(out) > 0 && unwrap_or(last(out), "") == "x" {
    out = take(out, len(out) - 1)
    n = n + 1
  }
  return n
}

fn eager(s: String) -> Int {
  return unwrap_or(parse_int(trim(s)), str_len(s))
}
`);
    const p = checkProject([{ name: "m", path: "canon/m.cn", src }]);
    expect(p.ok).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), "canon-cb1-"));
    mkdirSync(join(dir, "canon_generated"));
    for (const f of generateFastapi(p)) if (!f.userOwned) writeFileSync(join(dir, "canon_generated", f.path), f.text);
    const pyOut = py(dir, `
import json
from canon_generated.logic import to_ints, strip_x, eager
print(json.dumps([to_ints(["1", "x", "3"]), strip_x(["a", "x", "x"]), strip_x([]), eager(" 7 "), eager("abc")]))
`);
    const rt = new Runtime(testHost(new MemoryHost()));
    const mod = load(compileJs(src, "m.cn").js!, rt);
    const jsOut = [mod.fns.to_ints(["1", "x", "3"]), mod.fns.strip_x(["a", "x", "x"]), mod.fns.strip_x([]), mod.fns.eager(" 7 "), mod.fns.eager("abc")];
    expect(pyOut).toEqual(jsOut);
    expect(jsOut).toEqual([[1, 0, 3], 2, 0, 7, 3]);
  });

  it("a match inside a lambda is G002, not wrong code", async () => {
    const { checkProject, fmt, generateFastapi, TargetError } = await import("@canon/compiler");
    const src = fmt("fn f(xs: List[Option[Int]]) -> List[Int] {\n  return map(xs, |o| match o {\n    Some(v) => v,\n    None => 0,\n  })\n}\n");
    const p = checkProject([{ name: "m", path: "canon/m.cn", src }]);
    expect(p.modules[0].result.diagnostics).toEqual([]);
    expect(() => generateFastapi(p)).toThrow(TargetError);
  });
});

describe("models with forward references, and a project with no tables (found by FS-1 task authors)", () => {
  it("an Option or List of a type declared later imports, validates and passes mypy --strict", async () => {
    const { checkProject, fmt, generateFastapi } = await import("@canon/compiler");
    const { mkdirSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const src = fmt("type Order {\n  id: Int,\n  status: Option[Status],\n  history: List[Status],\n}\n\ntype Status =\n  | Open\n  | Paid(receipt: String)\n");
    const p = checkProject([{ name: "m", path: "canon/m.cn", src }]);
    expect(p.ok).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), "canon-fwd-"));
    mkdirSync(join(dir, "canon_generated"));
    for (const f of generateFastapi(p)) if (!f.userOwned) writeFileSync(join(dir, "canon_generated", f.path), f.text);
    expect(py(dir, `
import json
from canon_generated.models import Order, Paid
print(json.dumps(Order(id=1, status=Paid(receipt="r"), history=[]).model_dump()))
`)).toEqual({ id: 1, status: { kind: "Paid", receipt: "r" }, history: [] });
    const types = run("mypy", ["--strict", "canon_generated"], dir);
    expect(types.code, types.out).toBe(0);
  }, 120_000);
});

describe("CB-2: a comprehension's tuple target is never split across lines (found by CanonBench)", () => {
  it("a long map over group_by pairs generates valid Python, with the JavaScript runtime's result", async () => {
    const { checkProject, compileJs, fmt, generateFastapi } = await import("@canon/compiler");
    const { MemoryHost, Runtime, load, testHost } = await import("@canon/runtime");
    const { mkdirSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const src = fmt(`fn groups(words: List[String]) -> List[List[String]] {
  return words
    |> group_by(|w| str_len(w))
    |> filter(|key, members| len(members) >= 2)
    |> map(|key, members| members)
}

fn pairs(rows: List[(String, Int)], limit: Int) -> List[String] {
  return rows
    |> filter(|name, count| count >= limit && str_len(name) > 0 && str_len(name) < 40)
    |> map(|name, count| name + ":" + to_string(count) + ":" + to_string(count * limit))
}
`);
    const p = checkProject([{ name: "m", path: "canon/m.cn", src }]);
    expect(p.modules[0].result.diagnostics).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), "canon-cb2-"));
    mkdirSync(join(dir, "canon_generated"));
    for (const f of generateFastapi(p)) if (!f.userOwned) writeFileSync(join(dir, "canon_generated", f.path), f.text);
    const pyOut = py(dir, `
import json
from canon_generated.logic import groups, pairs
print(json.dumps([groups(["a", "b", "cc", "dd", "eee"]), pairs([("x", 3), ("yy", 1), ("", 9)], 2)]))
`);
    const rt = new Runtime(testHost(new MemoryHost()));
    const mod = load(compileJs(src, "m.cn").js!, rt);
    const jsOut = [mod.fns.groups(["a", "b", "cc", "dd", "eee"]), mod.fns.pairs([["x", 3], ["yy", 1], ["", 9]], 2)];
    expect(pyOut).toEqual(jsOut);
    const lint = run("ruff", ["format", "--isolated", "--check", "canon_generated"], dir);
    expect(lint.code, lint.out).toBe(0);
  }, 120_000);
});

describe("an api fn named like its own module (found by VA-1)", () => {
  it("does not shadow the logic module in api.py: requests work and mypy passes", async () => {
    const { checkProject, fmt } = await import("@canon/compiler");
    const src = fmt('type Gift {\n  code: String,\n  amount: Int,\n}\n\napi fn gift(input: Gift) -> Gift\n  route: POST "/gift"\n  requires: input.amount > 0\n{\n  return input\n}\n');
    // two modules, so each gets its own Python module: the one named gift holds an api fn gift
    const p = checkProject([{ name: "gift", path: "canon/gift.cn", src }, { name: "other", path: "canon/other.cn", src: fmt('api fn ping() -> Int\n  route: GET "/ping"\n{\n  return 1\n}\n') }]);
    expect(p.modules.flatMap((m) => m.result.diagnostics)).toEqual([]);
    const { buildBackend } = await import("./helpers/py");
    const dir = buildBackend(p);
    const r = py(dir, `
import json, os, tempfile
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "canon.db")
from fastapi.testclient import TestClient
from main import app
c = TestClient(app, raise_server_exceptions=False)
print(json.dumps([c.post("/gift", json={"code": "x", "amount": 5}).status_code, c.post("/gift", json={"code": "x", "amount": 0}).status_code, c.get("/ping").json()]))
`);
    expect(r).toEqual([200, 422, 1]);
    const types = run("mypy", ["--strict", "canon_generated", "main.py"], dir);
    expect(types.code, types.out).toBe(0);
  }, 120_000);
});
