/**
 * v0.5 M4 acceptance, the parts that need both sides: the generated TypeScript client, running in
 * Node, against the generated FastAPI backend served by uvicorn, for every endpoint; and the
 * client's validators against the server's require, on 1,000 random inputs per endpoint.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { camel, generateTsClient, walkExprs, type Fn, type ProjectResult } from "@canon/compiler";
import { buildBackend, loadProject, py, pyTool } from "./helpers/py";

const golden = join(__dirname, "golden", "todos");
const shopFixture = join(__dirname, "projects", "shop");

async function freePort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

interface Served {
  dir: string;
  url: string;
  proc: ChildProcess;
  client: any;
  validate: any;
}

const SERVE = `
import os, sys, tempfile
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "canon.db")
import uvicorn
from main import app
try:
    import canon_generated.api as api
    from canon_generated.net import Http
    from canon_generated.runtime import Ok
    class FakePayments(Http):
        def post(self, url, body):
            return Ok("receipt-" + body)
    app.dependency_overrides[api.PaymentsExampleCom.__metadata__[0].dependency] = lambda: FakePayments("payments.example.com")
except (ImportError, AttributeError):
    pass
uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]), log_level="error")
`;

async function serve(project: ProjectResult): Promise<Served> {
  const dir = buildBackend(project);
  writeFileSync(join(dir, "serve.py"), SERVE);
  const port = await freePort();
  const proc = spawn(pyTool("python"), ["serve.py", String(port)], { cwd: dir, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url + "/openapi.json");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // the client, transpiled to ES modules
  const out = join(dir, "client");
  mkdirSync(out, { recursive: true });
  for (const f of generateTsClient(project)) {
    const js = ts.transpileModule(f.text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
      .outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
    writeFileSync(join(out, f.path.replace(/\.ts$/, ".mjs")), js);
  }
  const imp = (n: string) => import(pathToFileURL(join(out, `${n}.mjs`)).href);
  const client = (await imp("client")).createClient(url);
  return { dir, url, proc, client, validate: await imp("validate") };
}

let todos: Served;
let shop: Served;
let shopProject: ProjectResult;
let todosProject: ProjectResult;
beforeAll(async () => {
  todosProject = loadProject(golden);
  shopProject = loadProject(shopFixture);
  [todos, shop] = await Promise.all([serve(todosProject), serve(shopProject)]);
}, 120_000);
afterAll(() => {
  todos?.proc.kill();
  shop?.proc.kill();
});

describe("the generated client against the generated backend", () => {
  it("the worked example: every endpoint, typed errors and client-side validation", async () => {
    const api = todos.client;
    expect(await api.createTodo({ title: "  milk " })).toEqual({ ok: true, value: { id: 1, title: "milk", done: false } });
    expect(await api.createTodo({ title: "   " })).toEqual({ ok: false, error: { kind: "ValidationError", rule: "str_len(trim(input.title)) > 0" } });
    expect(await api.completeTodo(1)).toEqual({ ok: true, value: { id: 1, title: "milk", done: true } });
    expect(await api.completeTodo(9)).toEqual({ ok: false, error: { kind: "NotFound", id: 9 } });
    expect(await api.listTodos(1, 10)).toEqual({ ok: true, value: [{ id: 1, title: "milk", done: true }] });
    expect(await api.listTodos(1, 101)).toEqual({ ok: false, error: { kind: "ValidationError", rule: "page >= 1 && per_page >= 1 && per_page <= 100" } });
  });

  it("the shop: every endpoint across three modules", async () => {
    const api = shop.client;
    const apple = { sku: "apple", name: "Apple", cents: 105, stock: 3, tags: ["fruit"] };
    const hammer = { sku: "hammer", name: "Hammer", cents: 1999, stock: 1, tags: ["tool", "heavy"] };
    expect(await api.addProduct(apple)).toEqual({ ok: true, value: apple });
    expect(await api.addProduct(apple)).toEqual({ ok: false, error: { kind: "Invalid", reason: "duplicate sku apple" } });
    expect((await api.addProduct({ ...hammer, sku: "x" })).error.kind).toBe("ValidationError");
    expect((await api.addProduct(hammer)).ok).toBe(true);
    expect(await api.getProduct("apple")).toEqual({ ok: true, value: apple });
    expect(await api.getProduct("a b?#é")).toEqual({ ok: false, error: { kind: "Missing", sku: "a b?#é" } });
    // a slash, or a whole "." or "..", cannot be a path segment: the client reports it, never throws
    expect((await api.getProduct("a/b")).error.kind).toBe("TransportError");
    expect((await api.listProducts(null, 1, 10)).value.map((p: { sku: string }) => p.sku)).toEqual(["apple", "hammer"]);
    expect((await api.listProducts("tool", 1, 10)).value.map((p: { sku: string }) => p.sku)).toEqual(["hammer"]);
    expect((await api.restock("apple", { amount: 2 })).value.stock).toBe(5);
    expect(await api.restock("pear", { amount: 2 })).toEqual({ ok: false, error: { kind: "Missing", sku: "pear" } });
    expect(await api.priceTable()).toEqual({ ok: true, value: { apple: "$1.05", hammer: "$19.99" } });
    expect(await api.averageCents("apple,hammer")).toEqual({ ok: true, value: 1052 });
    const trap = await api.averageCents("nothing");
    expect(trap.ok).toBe(false);
    expect(trap.error.kind).toBe("TransportError"); // a 500 from the server
    expect(await api.signup({ email: "ada@example.com", name: " Ada ", password: "correct horse" })).toEqual({ ok: true, value: { email: "ada@example.com", name: "Ada" } });
    expect(await api.signup({ email: "ada@example.com", name: "Ada", password: "correct horse" })).toEqual({ ok: false, error: { kind: "Taken", email: "ada@example.com" } });
    expect(await api.login({ email: "ada@example.com", name: "", password: "nope" })).toEqual({ ok: false, error: { kind: "BadLogin" } });
    expect((await api.login({ email: "ada@example.com", name: "", password: "correct horse" })).ok).toBe(true);
    expect((await api.rename("ada@example.com", { email: "", name: "Ada L." })).value.name).toBe("Ada L.");
    const order = await api.placeOrder({ email: "ada@example.com", lines: [{ sku: "apple", quantity: 2 }] });
    expect(order.value).toEqual({ id: 1, email: "ada@example.com", lines: [{ sku: "apple", quantity: 2 }], total: 210, status: { kind: "Open" } });
    expect((await api.pay(1)).value.status).toEqual({ kind: "Paid", receipt: "receipt-210" });
    expect(await api.summaries()).toEqual({ ok: true, value: [{ email: "ada@example.com", orders: 1, spent: 210 }] });
    expect(await api.openCount("ada@example.com")).toEqual({ ok: true, value: 0 });
    expect(await api.customers()).toEqual({ ok: true, value: [["Ada L.", 1]] });
    expect(await api.firstEmail()).toEqual({ ok: true, value: "ada@example.com" });
    expect(await api.deleteProduct("apple")).toEqual({ ok: true, value: true });
    expect(await api.deleteProduct("apple")).toEqual({ ok: true, value: false });
  });

  it("a server that is down is a TransportError, not an exception", async () => {
    const { createClient } = await import(pathToFileURL(join(todos.dir, "client", "client.mjs")).href);
    const r = await createClient(`http://127.0.0.1:${await freePort()}`).completeTodo(1);
    expect(r.ok).toBe(false);
    expect(r.error.kind).toBe("TransportError");
  });
});

// ------------------------------------------------------------------- validators against require

/** A seeded generator of awkward values: unicode whitespace, NEL, emoji, edge integers. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = ["", " ", "a", "Ada", " ", " ", "﻿", "\u0085", "​", "\t", "\n", "😀", "é", "@", ".", "x@y.io",
  "ada@example.com", "a b", "　", " ", "\u001c", "toolbox", "ab"];

function value(t: string, r: () => number): unknown {
  if (t === "Int") return [0, 1, -1, 2, 3, 7, 50, 51, 99, 100, 101, -100, 2 ** 31, Math.floor(r() * 200) - 50][Math.floor(r() * 14)];
  if (t === "String") {
    let s = "";
    const n = Math.floor(r() * 4);
    for (let i = 0; i < n; i++) s += PIECES[Math.floor(r() * PIECES.length)];
    return s;
  }
  if (t.startsWith("Option[")) return r() < 0.3 ? null : value(t.slice(7, -1), r);
  if (t.startsWith("List[")) return Array.from({ length: Math.floor(r() * 3) }, () => value(t.slice(5, -1), r));
  return null;
}

interface Case {
  fn: Fn;
  validator: string;
  args: (r: () => number) => unknown[];
  request: (args: unknown[]) => { method: string; path: string; params?: unknown; json?: unknown };
}

function cases(project: ProjectResult): Case[] {
  const records = new Map<string, [string, string][]>();
  const tyText = (te: any): string => (te.k === "TName" ? te.name + (te.args.length ? `[${te.args.map(tyText).join(", ")}]` : "") : "?");
  for (const m of project.modules) {
    for (const it of m.analysis.prog!.items) if (it.k === "RecordType") records.set(it.name, it.fields.map(([n, t]) => [n, tyText(t)]));
  }
  const gen = (t: string, r: () => number): unknown => {
    const rec = records.get(t);
    if (rec) return Object.fromEntries(rec.map(([n, ft]) => [n, gen(ft, r)]));
    if (t.startsWith("List[") && records.has(t.slice(5, -1))) return Array.from({ length: Math.floor(r() * 3) }, () => gen(t.slice(5, -1), r));
    return value(t, r);
  };
  const out: Case[] = [];
  for (const m of project.modules) {
    for (const fn of m.analysis.prog!.items) {
      if (fn.k !== "Fn" || !fn.route || !fn.requires || fn.extern) continue;
      out.push({
        fn,
        validator: "validate" + camel(fn.name).replace(/^./, (c: string) => c.toUpperCase()),
        args: (r) => fn.params.map(([, t]) => gen(tyText(t), r)),
        request: (args) => {
          let path = fn.route!.path;
          const params: Record<string, unknown> = {};
          let json: unknown;
          fn.params.forEach(([n, t], i) => {
            if (path.includes(`{${n}}`)) {
              // URLs cannot carry "", ".", ".." or "/" as a path segment (DECISIONS.md)
              const seg = String(args[i]).replace(/\//g, "");
              path = path.replace(`{${n}}`, encodeURIComponent(seg === "" || seg === "." || seg === ".." ? "x" : seg));
            }
            else if (t.k === "TName" && records.has(t.name)) json = args[i];
            else if (args[i] !== null) params[n] = args[i];
          });
          return { method: fn.route!.method, path, params, json };
        },
      });
    }
  }
  return out;
}

describe("validators reject exactly what the server's require rejects", () => {
  for (const [name, which] of [["the worked example", () => [todos, todosProject]], ["the shop", () => [shop, shopProject]]] as const) {
    it(`${name}: 1,000 random inputs per endpoint`, async () => {
      const [served, project] = which() as [Served, ProjectResult];
      for (const c of cases(project)) {
        const r = rng(2026);
        const inputs = Array.from({ length: 1000 }, () => c.args(r));
        const used = new Set([...walkExprs(c.fn.requires)].filter((x: any) => x.k === "Name").map((x: any) => x.path[0]));
        const clientSays = inputs.map((args) => served.validate[c.validator](...c.fn.params.flatMap(([n], i) => (used.has(n) ? [args[i]] : []))) !== null);
        const reqs = inputs.map((args) => c.request(args));
        writeFileSync(join(served.dir, "inputs.json"), JSON.stringify(reqs));
        const rule = (await import("@canon/compiler")).ruleText(c.fn.requires!);
        const serverSays = py(served.dir, `
import json, os, tempfile
os.environ["CANON_DATABASE"] = os.path.join(tempfile.mkdtemp(), "canon.db")
from fastapi.testclient import TestClient
from main import app
c = TestClient(app, raise_server_exceptions=False)
out = []
for q in json.load(open("inputs.json")):
    r = c.request(q["method"], q["path"], params=q.get("params"), json=q.get("json"))
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else None
    out.append(r.status_code == 422 and isinstance(body, dict) and body.get("error", {}).get("rule") == ${JSON.stringify(rule)})
print(json.dumps(out))
`) as boolean[];
        const disagree = inputs.flatMap((args, i) => (clientSays[i] !== serverSays[i] ? [{ args, client: clientSays[i], server: serverSays[i] }] : []));
        expect(disagree.slice(0, 3), `${c.fn.name}: ${disagree.length} disagreements`).toEqual([]);
        // the inputs exercise both outcomes
        expect(clientSays.some(Boolean) && clientSays.some((x) => !x), c.fn.name).toBe(true);
      }
    }, 300_000);
  }
});
