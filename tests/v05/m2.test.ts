/**
 * v0.5 M2 acceptance: api fn with route:, tables and the std.store built-ins, store(table) and
 * net(host) effects, canon manifest, and canon test calling api fns with empty tables.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, check, checkProject, compileJs, fmt, manifest, manifestText, analyze } from "@canon/compiler";
import { MemoryHost, runMain, runTests, testHost } from "@canon/runtime";

const root = join(__dirname, "..", "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const todosDir = join(__dirname, "golden", "todos");
const TODOS = readFileSync(join(todosDir, "canon", "todos.cn"), "utf8");
const py = { features: { py: true } };

function canon(args: string[], cwd = root) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const codes = (src: string) => check(src, "main.cn").diagnostics.map((d) => d.code);
const first = (src: string) => check(src, "main.cn").diagnostics[0];

function run(src: string) {
  const c = compileJs(src, "main.cn");
  if (!c.js) throw new Error(JSON.stringify(c.check.diagnostics, null, 2));
  const mem = new MemoryHost();
  const r = runMain(c.js, testHost(mem), {});
  return { ...r, out: mem.out.join("\n") };
}

const TYPES = `type Todo {
  id: Int,
  title: String,
  done: Bool,
}

type NewTodo {
  title: String,
}

type TodoError =
  | NotFound(id: Int)
`;

/** A program with the types above and one api fn. */
const api = (fn: string, extra = "") => `${extra}${TYPES}\n${fn}`;

describe("api fn", () => {
  it("the worked example is canonical and checks in both surfaces", () => {
    expect(fmt(TODOS)).toBe(TODOS);
    expect(check(TODOS, "todos.cn").diagnostics).toEqual([]);
    const p = fmt(TODOS, py);
    expect(p).toContain('@api("POST", "/todos/{id}/complete")\n@effects("store(todos)")\ndef complete_todo(id: int) -> Result[Todo, TodoError]:');
    expect(p).toContain('todos = table(Todo, key="id")');
    expect(check(p, "todos.cn", py).diagnostics).toEqual([]);
    expect(fmt(p)).toBe(TODOS);
  });

  it("route: belongs to an api fn, and an api fn needs one", () => {
    expect(() => fmt('fn f() -> Int\n  route: GET "/f"\n{\n  return 1\n}\n')).toThrow(/belongs to an api fn/);
    expect(() => fmt("api fn f() -> Int {\n  return 1\n}\n")).toThrow(/needs a route: clause/);
    expect(() => fmt('api fn f() -> Int\n  route: FETCH "/f"\n{\n  return 1\n}\n')).toThrow(/HTTP method/);
    expect(() => fmt('api fn f() -> Int\n  route: GET "f"\n{\n  return 1\n}\n')).toThrow(/starts with \//);
  });

  it("clauses print in the order route, effects, requires, ensures", () => {
    const src = 'api fn f(n: Int) -> Int\n  requires: n > 0\n  route: GET "/f"\n{\n  return n\n}\n';
    expect(fmt(src)).toBe('api fn f(n: Int) -> Int\n  route: GET "/f"\n  requires: n > 0\n{\n  return n\n}\n');
  });

  it("api and table stay usable as ordinary names", () => {
    expect(codes("fn api(table: Int) -> Int {\n  return table\n}\n")).toEqual([]);
  });

  it("an api fn is an ordinary function: other code can call it", () => {
    const src = api('api fn hello(name: String) -> String\n  route: GET "/hello"\n{\n  return "hi " + name\n}\n\nfn main() -> Unit\n  effects: io\n{\n  print(hello("ada"))\n}\n');
    expect(run(src).out).toBe("hi ada");
  });
});

describe("A001: the shape of an api fn", () => {
  const a001 = (fn: string) => {
    const ds = check(api(fn), "main.cn").diagnostics;
    expect(ds.map((d) => d.code), JSON.stringify(ds)).toContain("A001");
    return ds.find((d) => d.code === "A001")!.message;
  };

  it("GET and DELETE have no body: every other parameter is a scalar query parameter", () => {
    expect(a001('api fn f(t: NewTodo) -> Int\n  route: GET "/f"\n{\n  return 1\n}\n')).toMatch(/query parameter t must be Int, Float, Bool, String or an Option of one, not NewTodo; GET has no body/);
    expect(a001('api fn f(xs: List[Int]) -> Int\n  route: DELETE "/f"\n{\n  return 1\n}\n')).toMatch(/query parameter xs/);
    expect(codes(api('api fn f(q: Option[String], n: Int) -> Int\n  route: GET "/f"\n{\n  return n\n}\n'))).toEqual([]);
  });

  it("POST, PUT and PATCH take at most one record body", () => {
    expect(a001('api fn f(a: NewTodo, b: NewTodo) -> Int\n  route: POST "/f"\n{\n  return 1\n}\n')).toMatch(/at most one parameter besides the path parameters/);
    expect(a001('api fn f(n: Int) -> Int\n  route: PUT "/f"\n{\n  return n\n}\n')).toMatch(/body parameter n must be a record type, not Int/);
    expect(codes(api('api fn f(id: Int, input: NewTodo) -> Int\n  route: PATCH "/f/{id}"\n{\n  return id\n}\n'))).toEqual([]);
  });

  it("path parameters must be parameters of type Int or String", () => {
    expect(a001('api fn f() -> Int\n  route: GET "/f/{id}"\n{\n  return 1\n}\n')).toMatch(/binds \{id\}, but the function has no parameter id/);
    expect(a001('api fn f(id: Float) -> Float\n  route: GET "/f/{id}"\n{\n  return id\n}\n')).toMatch(/path parameter id must be Int or String, not Float/);
    expect(a001('api fn f(id: Int) -> Int\n  route: GET "/f/{id}/{id}"\n{\n  return id\n}\n')).toMatch(/binds \{id\} twice/);
    expect(a001('api fn f(id: Int) -> Int\n  route: GET "/f/x{id}"\n{\n  return id\n}\n')).toMatch(/segment "x\{id\}" is not valid/);
  });

  it("outputs are wire types, and errors are sum types", () => {
    expect(a001('api fn f() -> Result[Todo, String]\n  route: GET "/f"\n{\n  return Err("x")\n}\n')).toMatch(/error type must be a sum type/);
    expect(a001('api fn f() -> fn(Int) -> Int\n  route: GET "/f"\n{\n  return |x| x\n}\n')).toMatch(/function type/);
    expect(a001('api fn f() -> Option[Option[Int]]\n  route: GET "/f"\n{\n  return None\n}\n')).toMatch(/null would mean two things/);
    expect(a001('api fn f() -> Map[Int, String]\n  route: GET "/f"\n{\n  return map_from([])\n}\n')).toMatch(/map keys must be String/);
    expect(codes(api('api fn f() -> Map[String, List[(Int, Todo)]]\n  route: GET "/f"\n{\n  return map_from([])\n}\n'))).toEqual([]);
  });

  it("wire field names must work in Python, and a variant cannot have a field named kind", () => {
    const ds = check('type Odd {\n  class: Int,\n}\n\napi fn f() -> Odd\n  route: GET "/f"\n{\n  return Odd { class: 1 }\n}\n', "main.cn").diagnostics;
    expect(ds.find((d) => d.code === "A001")!.message).toMatch(/field Odd\.class cannot be a field name in the generated Python/);
    const ks = check('type E =\n  | Bad(kind: String)\n\napi fn f() -> Result[Int, E]\n  route: GET "/f"\n{\n  return Ok(1)\n}\n', "main.cn").diagnostics;
    expect(ks.find((d) => d.code === "A001")!.message).toMatch(/field named kind/);
  });

  it("an api fn is not generic", () => {
    expect(a001('api fn f[T](x: Int) -> Int\n  route: GET "/f"\n{\n  return x\n}\n')).toMatch(/cannot be generic/);
  });
});

describe("A002: route conflicts", () => {
  it("the same method and path twice", () => {
    const src = api('api fn a() -> Int\n  route: GET "/x"\n{\n  return 1\n}\n\napi fn b() -> Int\n  route: GET "/x"\n{\n  return 2\n}\n');
    expect(first(src).code).toBe("A002");
    expect(first(src).message).toBe("api fn b: GET /x is already the route of api fn a");
  });

  it("paths that differ only in parameter names conflict; different methods do not", () => {
    const src = api('api fn a(id: Int) -> Int\n  route: GET "/t/{id}"\n{\n  return id\n}\n\napi fn b(todo_id: Int) -> Int\n  route: GET "/t/{todo_id}"\n{\n  return todo_id\n}\n\napi fn c(id: Int) -> Int\n  route: DELETE "/t/{id}"\n{\n  return id\n}\n');
    expect(codes(src)).toEqual(["A002"]);
  });

  it("across the modules of a project", () => {
    const r = checkProject([
      { name: "a", path: "canon/a.cn", src: 'api fn one() -> Int\n  route: GET "/x"\n{\n  return 1\n}\n' },
      { name: "b", path: "canon/b.cn", src: 'api fn two() -> Int\n  route: GET "/x"\n{\n  return 2\n}\n' },
    ]);
    expect(r.modules[1].result.diagnostics.map((d) => d.message)).toEqual(["api fn two: GET /x is already the route of api fn one in module a"]);
  });
});

describe("A003: validation must be portable", () => {
  const a003 = (req: string, extra = "") =>
    check(api(`api fn f(input: NewTodo, n: Int) -> Int\n  route: POST "/f/{n}"\n  requires: ${req}\n{\n  return n\n}\n`, extra), "main.cn").diagnostics
      .filter((d) => d.code === "A003").map((d) => d.message);

  it("comparisons, arithmetic, logic, fields, literals and the portable built-ins are allowed", () => {
    expect(a003('str_len(trim(input.title)) > 0 && n % 2 == 0 && !(n > 100) || contains(["a", "b"], input.title)')).toEqual([]);
    expect(a003("is_email(input.title) && len([1, 2]) == 2")).toEqual([]);
  });

  it("a call to anything else", () => {
    expect(a003("is_short(input.title)", "fn is_short(s: String) -> Bool {\n  return str_len(s) < 9\n}\n\n")[0])
      .toMatch(/api fn f: its requires runs in the client too, so it cannot use a call to is_short; it may use comparisons, arithmetic/);
    expect(a003("abs(n) < 3")[0]).toMatch(/a call to abs/);
  });

  it("lambdas, match and variants", () => {
    expect(a003("len(filter([1], |x| x > n)) > 0")[0]).toMatch(/a call to filter/);
    expect(a003("match n {\n    0 => false,\n    _ => true,\n  }").length + a003("unwrap_or(None, 1) > 0").length).toBeGreaterThan(0);
  });

  it("only an api fn's requires is restricted", () => {
    expect(codes(`fn f(n: Int) -> Int\n  requires: abs(n) < 3\n{\n  return n\n}\n`)).toEqual([]);
  });
});

describe("tables and std.store", () => {
  it("run in the JavaScript runtime, in memory", () => {
    expect(run(readFileSync(join(root, "tests", "run", "v05_tables.cn"), "utf8")).out)
      .toBe(readFileSync(join(root, "tests", "run", "v05_tables.out"), "utf8").trimEnd());
  });

  it("R007: inserting a duplicate key traps", () => {
    const src = 'table todos: Todo key id\n\n' + TYPES + '\nfn main() -> Unit\n  effects: store(todos)\n{\n  insert(todos, Todo { id: 1, title: "a", done: false })\n  insert(todos, Todo { id: 1, title: "b", done: false })\n}\n';
    const r = run(src);
    expect(r.trap?.code).toBe("R007");
    expect(r.trap?.message).toBe("duplicate key 1 in table todos");
  });

  it("the key must be an Int or String field of a record; next_id needs an Int key", () => {
    expect(first("table todos: Todo key title_x\n\n" + TYPES).message).toMatch(/Todo has no field title_x/);
    expect(first("table todos: Todo key done\n\n" + TYPES).message).toMatch(/key Todo\.done must be Int or String/);
    expect(first("table errs: TodoError key id\n\n" + TYPES).message).toMatch(/rows must be a record type/);
    const strKey = "table todos: Todo key title\n\n" + TYPES + "\nfn f() -> Int\n  effects: store(todos)\n{\n  return next_id(todos)\n}\n";
    expect(codes(strKey)).toContain("T001");
  });

  it("A004: a table is only the first argument of a store built-in", () => {
    const src = "table todos: Todo key id\n\n" + TYPES + "\nfn f() -> Int\n  effects: store(todos)\n{\n  let t = todos\n  return count(t)\n}\n";
    expect(codes(src)).toContain("A004");
    expect(check(src, "main.cn").diagnostics.find((d) => d.code === "A004")!.message)
      .toBe("table todos can only be the first argument of get, scan, insert, save, delete, next_id or count");
  });

  it("without a table, get, save and count are free names (programs from before v0.5 still check)", () => {
    expect(codes("fn save(n: Int) -> Int {\n  return n\n}\n\nfn count(xs: List[Int]) -> Int {\n  return len(xs)\n}\n")).toEqual([]);
    expect(first("table todos: Todo key id\n\n" + TYPES + "\nfn save(n: Int) -> Int {\n  return n\n}\n").message).toMatch(/built-in in a program with tables/);
  });
});

describe("store(table) effects", () => {
  const T = "table todos: Todo key id\n\ntable notes: Todo key id\n\n" + TYPES;
  it("are exact per table, with patches (E101, E102)", () => {
    const src = T + "\nfn f() -> Int\n  effects: store(notes)\n{\n  return count(todos)\n}\n";
    const ds = check(src, "main.cn").diagnostics;
    expect(ds.map((d) => [d.code, d.message])).toEqual([
      ["E101", "fn f uses effects it does not declare: store(todos) (via count)"],
      ["E102", "fn f declares effects it never uses: store(notes) (effect lists are exact)"],
    ]);
    expect(applyPatch(src, ds[0].fix!.diff)).toBe(src.replace("store(notes)", "store(todos)"));
  });

  it("flow through calls, and store(x) must name a table (E100)", () => {
    const src = T + "\nfn n() -> Int\n  effects: store(todos)\n{\n  return count(todos)\n}\n\nfn m() -> Int {\n  return n()\n}\n";
    expect(first(src).message).toBe("fn m uses effects it does not declare: store(todos) (via n)");
    expect(first(T + "\nfn f() -> Unit\n  effects: store(users)\n{}\n").message).toMatch(/unknown table 'users' in store\(users\); the tables are notes, todos/);
  });

  it("contracts stay pure: a store call in requires is E103", () => {
    const src = T + "\nfn f(id: Int) -> Int\n  effects: store(todos)\n  requires: count(todos) > 0\n{\n  return id\n}\n";
    expect(codes(src)).toContain("E103");
  });

  it("tests use tables without declaring them", () => {
    expect(codes(T + '\ntest "t" {\n  assert(count(todos) == 0)\n}\n')).toEqual([]);
  });
});

describe("net(host) effects", () => {
  const fn = (effects: string, body: string) =>
    `fn f(u: String) -> Result[String, Error]\n  effects: ${effects}\n{\n  return ${body}\n}\n`;

  it("a literal URL must use a declared host (E104, with a patch adding it)", () => {
    const src = fn("net(api.stripe.com)", 'http_get("https://evil.example.com/x")');
    const ds = check(src, "main.cn").diagnostics;
    expect(ds.map((d) => d.code)).toEqual(["E104", "E102"]);
    expect(ds[0].message).toBe("fn f calls host evil.example.com (via http_get), but declares only net(api.stripe.com); add net(evil.example.com), or declare plain net for any host");
    expect(applyPatch(src, ds[0].fix!.diff)).toContain("effects: net(api.stripe.com), net(evil.example.com)");
  });

  it("a declared host, plain net, and a computed URL under declared hosts all check", () => {
    expect(codes(fn("net(api.stripe.com)", 'http_get("https://API.stripe.com/v1/charges")'))).toEqual([]);
    expect(codes(fn("net", 'http_get("https://evil.example.com/x")'))).toEqual([]);
    expect(codes(fn("net(api.stripe.com)", "http_get(u)"))).toEqual([]);
  });

  it("with no net effect, the E101 patch names the host of a literal URL, or plain net for a computed one", () => {
    const bare = (body: string) => `fn f(u: String) -> Result[String, Error] {\n  return ${body}\n}\n`;
    const lit = bare('http_get("https://api.stripe.com/x")');
    expect(first(lit).message).toBe("fn f uses effects it does not declare: net(api.stripe.com) (via http_get)");
    const comp = bare("http_get(u)");
    expect(first(comp).message).toBe("fn f uses effects it does not declare: net (via http_get)");
  });

  it("a host must be a host name (E100)", () => {
    expect(first(fn("net(not a host)", "http_get(u)")).message).toMatch(/an effect's argument has no spaces/);
    expect(first(fn("net(Bad_Host)", "http_get(u)")).message).toBe("net(Bad_Host) needs a host name, like net(api.example.com)");
  });

  it("the capability guard traps a computed URL to an undeclared host with R006", () => {
    const src = 'fn fetch(u: String) -> Result[String, Error]\n  effects: net(api.stripe.com)\n{\n  return http_get(u)\n}\n\nfn main() -> Unit\n  effects: net(api.stripe.com)\n{\n  let r = fetch("https://evil.example.com/steal")\n}\n';
    const r = run(src);
    expect(r.trap?.code).toBe("R006");
    expect(r.trap?.message).toBe("effect net(evil.example.com) denied (http_get): the calling function declares only net(api.stripe.com)");
  });

  it("the guard lets a declared host through to the host", () => {
    const src = 'fn fetch(u: String) -> Result[String, Error]\n  effects: net(api.stripe.com)\n{\n  return http_get(u)\n}\n\nfn main() -> Unit\n  effects: net(api.stripe.com)\n{\n  let r = fetch("https://api.stripe.com/x")\n}\n';
    expect(run(src).trap).toBeUndefined();
  });
});

describe("canon manifest", () => {
  const SPEC = [
    "POST /todos                 create_todo     store(todos)   checks: str_len(trim(input.title)) > 0",
    "POST /todos/{id}/complete   complete_todo   store(todos)",
    "GET  /todos                 list_todos      store(todos)   checks: page >= 1 && per_page >= 1 && per_page <= 100",
    "",
  ].join("\n");

  it("prints the worked example's manifest exactly", () => {
    expect(canon(["manifest"], todosDir)).toEqual({ code: 0, out: SPEC, err: "" });
    expect(canon(["manifest", "tests/v05/golden/todos/canon/todos.cn"]).out).toBe(SPEC);
  });

  it("prints the same rules from Canon-Py", () => {
    const an = analyze(fmt(TODOS, py), "todos.cn", py);
    expect(manifestText(manifest([{ module: "todos", prog: an.prog! }]))).toBe(SPEC);
  });

  it("--json lists route, function, effects, tables, hosts and checks", () => {
    const j = JSON.parse(canon(["manifest", "--json"], todosDir).out);
    expect(j.ok).toBe(true);
    expect(j.warnings).toEqual([]);
    expect(j.endpoints).toEqual([
      { method: "POST", path: "/todos", function: "create_todo", module: "todos", effects: ["store(todos)"], tables: ["todos"], hosts: [], checks: "str_len(trim(input.title)) > 0" },
      { method: "POST", path: "/todos/{id}/complete", function: "complete_todo", module: "todos", effects: ["store(todos)"], tables: ["todos"], hosts: [], checks: null },
      { method: "GET", path: "/todos", function: "list_todos", module: "todos", effects: ["store(todos)"], tables: ["todos"], hosts: [], checks: "page >= 1 && per_page >= 1 && per_page <= 100" },
    ]);
  });

  it("W010 flags an endpoint that may call any host", () => {
    const src = 'api fn ping() -> Result[String, Error]\n  route: GET "/ping"\n  effects: net\n{\n  return http_get("https://x.io")\n}\n';
    const an = analyze(src, "main.cn");
    const m = manifest([{ module: null, prog: an.prog! }]);
    expect(m.endpoints[0].hosts).toEqual(["*"]);
    expect(manifestText(m)).toBe("GET /ping   ping   net\nwarning W010: api fn ping may call any host (effects: net); name the hosts it calls, like net(api.example.com)\n");
    const named = analyze(src.replace("effects: net", "effects: net(x.io)"), "main.cn");
    expect(manifest([{ module: null, prog: named.prog! }]).warnings).toEqual([]);
  });

  it("a program that does not check gets diagnostics, not a manifest", () => {
    const r = canon(["manifest", "tests/run/v05_tables.cn"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^no endpoints/);
  });
});

describe("canon test and api fns", () => {
  const src = TODOS + '\ntest "create, then list" {\n  let a = create_todo(NewTodo { title: "  milk " })\n  assert(a.title == "milk" && a.id == 1)\n  assert(len(list_todos(1, 10)) == 1)\n}\n\ntest "tables start empty for every test" {\n  assert(len(list_todos(1, 10)) == 0)\n  assert(complete_todo(1) == Err(NotFound(1)))\n}\n';

  it("tests call api fns directly, with tables empty for each test", () => {
    const c = compileJs(src, "todos.cn");
    expect(c.check.diagnostics).toEqual([]);
    const results = runTests(c.js!, testHost(new MemoryHost()));
    expect(results.map((t) => [t.name, t.passed])).toEqual([["create, then list", true], ["tables start empty for every test", true]]);
  });

  it("a failing requires traps R001 when called from Canon", () => {
    const c = compileJs(TODOS + '\ntest "blank" {\n  let a = create_todo(NewTodo { title: "  " })\n}\n', "todos.cn");
    const [t] = runTests(c.js!, testHost(new MemoryHost()));
    expect(t.trap?.code).toBe("R001");
  });
});
