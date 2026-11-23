/**
 * v0.5 M4 acceptance: the TypeScript client. Generated files pass prettier --check (printWidth
 * 100), tsc --strict and eslint; client methods return Result and never throw; validators reject
 * exactly what the Canon requires rejects, on 1,000 random inputs per endpoint. (The golden
 * files are tests/v05/golden-ts.test.ts; the run against the generated backend is M3/M4's
 * integration test.)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import js from "@eslint/js";
import { ESLint } from "eslint";
import ts from "typescript";
import tseslint from "typescript-eslint";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkProject, compileJs, generateTsClient, linkProject, moduleName, programText, TRIM_WHITESPACE,
  type ModuleSource, type ProjectResult, type Program, type TypeExpr,
} from "@canon/compiler";
import { load, MemoryHost, Runtime, testHost } from "@canon/runtime";
import { randomRules } from "./helpers/rules";

const root = join(__dirname, "..", "..");
const bin = (name: string) => join(root, "node_modules", ".bin", name);

function readProject(dir: string): ModuleSource[] {
  const src = join(dir, "canon");
  const walk = (d: string): string[] =>
    readdirSync(d).sort().flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".cn") ? [join(d, f)] : []));
  return walk(src).map((f) => ({ name: moduleName(relative(src, f)), path: relative(dir, f), src: readFileSync(f, "utf8") }));
}

function checked(mods: ModuleSource[]): ProjectResult {
  const r = checkProject(mods);
  if (!r.ok) throw new Error(JSON.stringify(r.modules.map((m) => [m.path, m.result.diagnostics]), null, 2));
  return r;
}

function writeOut(r: ProjectResult): string {
  const dir = mkdtempSync(join(tmpdir(), "canon-ts-"));
  for (const f of generateTsClient(r)) writeFileSync(join(dir, f.path), f.text);
  return dir;
}

const tsFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f));

function prettier(dir: string) {
  const r = spawnSync(bin("prettier"), ["--no-config", "--print-width", "100", "--check", ...tsFiles(dir)], { encoding: "utf8" });
  if (r.status !== 0) {
    const diffs = tsFiles(dir).map((f) => {
      const want = spawnSync(bin("prettier"), ["--no-config", "--print-width", "100", f], { encoding: "utf8" }).stdout;
      return want === readFileSync(f, "utf8") ? "" : `--- ${f}\n${readFileSync(f, "utf8")}\n+++ prettier\n${want}`;
    });
    return diffs.join("");
  }
  return "";
}

function tsc(dir: string): string {
  const r = spawnSync(bin("tsc"), [
    "--strict", "--noEmit", "--noUnusedLocals", "--noUnusedParameters", "--target", "es2022", "--module", "esnext",
    "--moduleResolution", "bundler", "--lib", "es2022,dom", "--skipLibCheck", ...tsFiles(dir),
  ], { encoding: "utf8" });
  return r.status === 0 ? "" : r.stdout + r.stderr;
}

async function eslint(dir: string): Promise<string> {
  const e = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [js.configs.recommended, ...tseslint.configs.recommended] as never,
  });
  const results = await e.lintFiles(tsFiles(dir));
  return results.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line}: ${m.ruleId}: ${m.message}`)).join("\n");
}

/** Transpile the generated files to ES modules and import the client and validators. */
async function loadTs(dir: string): Promise<{ client: any; validate: any; runtime: any }> {
  const out = join(dir, "js");
  mkdirSync(out, { recursive: true });
  for (const f of tsFiles(dir)) {
    const text = ts.transpileModule(readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
    writeFileSync(join(out, f.split("/").pop()!.replace(/\.ts$/, ".mjs")), text);
  }
  const imp = (n: string) => import(pathToFileURL(join(out, `${n}.mjs`)).href);
  return { client: await imp("client"), validate: await imp("validate"), runtime: await imp("runtime") };
}

const TODOS = readProject(join(__dirname, "golden", "todos"));
const WIDE = readProject(join(__dirname, "projects", "wide"));

describe("generated TypeScript passes prettier, tsc --strict and eslint", () => {
  for (const [name, mods] of [["the worked example", TODOS], ["a wide multi-module project", WIDE]] as const) {
    it(name, async () => {
      const dir = writeOut(checked(mods));
      expect(prettier(dir)).toBe("");
      expect(tsc(dir)).toBe("");
      expect(await eslint(dir)).toBe("");
    });
  }
});

describe("layout", () => {
  const files = generateTsClient(checked(WIDE));
  const file = (p: string) => files.find((f) => f.path === p)!.text;

  it("one flat set of files for the whole project, headed by the source folder", () => {
    expect(files.map((f) => f.path)).toEqual(["types.ts", "validate.ts", "client.ts", "runtime.ts"]);
    expect(file("types.ts").split("\n")[0]).toBe("// Generated by Canon 0.5.0 from the Canon modules in canon/. Do not edit: change the Canon source.");
    expect(file("runtime.ts").split("\n")[0]).toBe("// Generated by Canon 0.5.0. Do not edit: change the Canon source.");
  });

  it("types.ts holds the wire types reachable from api fns, in module then source order", () => {
    const names = [...file("types.ts").matchAll(/^export (?:interface|type) (\w+)/gm)].map((m) => m[1]);
    expect(names).toEqual(["Product", "NewProduct", "ProductError", "User", "Signup", "Rename", "AccountError"]);
  });

  it("wire types map as the spec's table says", () => {
    const t = file("types.ts");
    expect(t).toContain("  dims: [number, number] | null;\n  stock: Record<string, number>;");
    expect(t).toContain("  scores: (number | null)[];");
    expect(t).toContain('export type AccountError = { kind: "EmailTaken"; email: string } | { kind: "Weak" };');
    expect(t).toContain('export type ProductError =\n  | { kind: "NotFound"; slug: string }\n');
  });

  it("String path parameters are encoded; Unit returns are null; field names never change", () => {
    const c = file("client.ts");
    expect(c).toContain("`/products/${encodeURIComponent(slug)}`");
    expect(c).toContain("`/users/${id}`");
    expect(c).toContain("Promise<Result<null, TransportError>>");
    expect(c).toContain("query: { include_stock: includeStock }");
  });

  it("the runtime's trim uses JavaScript's trim set, exported for the Python runtime", () => {
    expect([...TRIM_WHITESPACE].every((ch) => ch.trim() === "")).toBe(true);
    const all = Array.from({ length: 0x10000 }, (_, i) => String.fromCharCode(i)).filter((ch) => ch.trim() === "").join("");
    expect(all).toBe(TRIM_WHITESPACE);
  });
});

describe("client methods return Result and never throw", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const calls: { url: string; init: RequestInit }[] = [];
  const respond = (fn: () => Response | Promise<Response>) => {
    calls.length = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return fn();
    }) as typeof fetch;
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("on success, typed errors, validation errors, server errors, bad JSON and network failure", async () => {
    const { client } = await loadTs(writeOut(checked(WIDE)));
    const api = client.createClient("http://api.test");

    respond(() => json(200, { slug: "a", name: "A" }));
    expect(await api.getProduct("a b/c", null)).toEqual({ ok: true, value: { slug: "a", name: "A" } });
    expect(calls[0].url).toBe("http://api.test/products/a%20b%2Fc");
    expect(calls[0].init.method).toBe("GET");

    respond(() => json(200, []));
    await api.listProducts(5, null, 2, 10);
    expect(calls[0].url).toBe("http://api.test/products?low=5&page=2&n=10");

    respond(() => json(400, { error: { kind: "NotFound", slug: "x" } }));
    expect(await api.getProduct("x", true)).toEqual({ ok: false, error: { kind: "NotFound", slug: "x" } });
    expect(calls[0].url).toBe("http://api.test/products/x?include_stock=true");

    respond(() => json(422, { error: { kind: "ValidationError", rule: "page >= 1" } }));
    expect(await api.listProducts(null, null, 1, 10)).toEqual({ ok: false, error: { kind: "ValidationError", rule: "page >= 1" } });

    respond(() => json(500, { error: { kind: "InternalError" } }));
    expect(await api.ping()).toEqual({ ok: false, error: { kind: "TransportError", status: 500, message: "HTTP 500" } });

    respond(() => json(404, { detail: "Not Found" }));
    expect(await api.ping()).toEqual({ ok: false, error: { kind: "TransportError", status: 404, message: "HTTP 404" } });

    respond(() => new Response("<html>oops</html>", { status: 200 }));
    expect(await api.ping()).toEqual({ ok: false, error: { kind: "TransportError", status: 200, message: "the response is not JSON" } });

    respond(() => {
      throw new TypeError("fetch failed");
    });
    expect(await api.ping()).toEqual({ ok: false, error: { kind: "TransportError", status: null, message: "fetch failed" } });

    respond(() => json(200, null));
    expect(await api.ping()).toEqual({ ok: true, value: null });

    respond(() => json(200, { id: 1 }));
    const body = { email: "ada@example.com", password: "long enough", display_name: "Ada" };
    expect((await api.signup(body)).ok).toBe(true);
    expect(calls[0].init).toMatchObject({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  });

  it("a request that fails validation is never sent", async () => {
    const { client } = await loadTs(writeOut(checked(TODOS)));
    const api = client.createClient("/api");
    respond(() => json(200, {}));
    expect(await api.createTodo({ title: "   " })).toEqual({ ok: false, error: { kind: "ValidationError", rule: "str_len(trim(input.title)) > 0" } });
    expect(await api.listTodos(0, 10)).toEqual({
      ok: false, error: { kind: "ValidationError", rule: "page >= 1 && per_page >= 1 && per_page <= 100" },
    });
    expect(calls).toEqual([]);
  });
});

// ------------------------------------------------------------------ validators against Canon

/** A random wire value of a type, as JSON (TypeScript's view). */
function randomValue(t: TypeExpr, r: () => number, records: Map<string, [string, TypeExpr][]>): unknown {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  if (t.k !== "TName") throw new Error("unexpected type");
  switch (t.name) {
    case "Int": return pick([-120, -3, -1, 0, 1, 2, 3, 4, 7, 8, 9, 10, 64, 65, 99, 100, 101, 999, 1000, Math.floor(r() * 300) - 100]);
    case "Float": return pick([-1.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2, 3.75]);
    case "Bool": return r() < 0.5;
    case "String": return pick(["", " ", "a", "ab", "abc", "m", "z", "zz", "  x  ", " x ", " ", "ada@example.com", "a@b", "a@b.c", "a b@c.d",
      "it's", 'say "hi"', "😀", "😀😀😀", "x y", "a".repeat(70), "　hi﻿"]);
    case "Option": return r() < 0.4 ? null : randomValue(t.args[0], r, records);
    case "List": return Array.from({ length: Math.floor(r() * 4) }, () => randomValue(t.args[0], r, records));
    default: {
      const fields = records.get(t.name)!;
      return Object.fromEntries(fields.map(([f, ft]) => [f, randomValue(ft, r, records)]));
    }
  }
}

/** The same value as the Canon JavaScript runtime represents it. */
function toCanon(t: TypeExpr, v: unknown, records: Map<string, [string, TypeExpr][]>): unknown {
  if (t.k !== "TName") throw new Error("unexpected type");
  if (t.name === "Option") return v === null ? { $t: "None" } : { $t: "Some", value: toCanon(t.args[0], v, records) };
  if (t.name === "List") return (v as unknown[]).map((x) => toCanon(t.args[0], x, records));
  const fields = records.get(t.name);
  if (fields) return { $t: t.name, ...Object.fromEntries(fields.map(([f, ft]) => [f, toCanon(ft, (v as Record<string, unknown>)[f], records)])) };
  return v;
}

async function agreement(mods: ModuleSource[], perEndpoint: number) {
  const project = checked(mods);
  const { validate } = await loadTs(writeOut(project));
  const linked: Program = linkProject(project);
  const c = compileJs(programText(linked), "linked.cn");
  if (!c.js) throw new Error(JSON.stringify(c.check.diagnostics));
  const rt = new Runtime(testHost(new MemoryHost()), { contracts: true });
  const mod = load(c.js, rt);
  const records = new Map<string, [string, TypeExpr][]>();
  for (const it of linked.items) if (it.k === "RecordType") records.set(it.name, it.fields);
  let seed = 7;
  const r = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let endpoints = 0;
  const disagreements: string[] = [];
  for (const it of linked.items) {
    if (it.k !== "Fn" || !it.route || !it.requires) continue;
    endpoints++;
    const name = "validate" + it.name.replace(/(^|_)([a-z0-9])/g, (_m, _u, ch: string) => ch.toUpperCase());
    const names = new Set<string>();
    const visit = (v: unknown) => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) return v.forEach(visit);
      const n = v as { k?: string; path?: string[] };
      if (n.k === "Name" && n.path) names.add(n.path[0]);
      Object.values(v).forEach(visit);
    };
    visit(it.requires);
    const used = it.params.filter(([p]) => names.has(p));
    for (let n = 0; n < perEndpoint; n++) {
      rt.resetTables();
      const values = it.params.map(([, t]) => randomValue(t, r, records));
      let canonRejects: boolean;
      try {
        mod.fns[it.name](...it.params.map(([, t], i) => toCanon(t, values[i], records)));
        canonRejects = false;
      } catch (e) {
        canonRejects = (e as { code?: string }).code === "R001";
        rt.stack.length = 0;
      }
      const args = it.params.map(([p], i) => [p, values[i]] as const).filter(([p]) => used.some(([q]) => q === p)).map(([, v]) => v);
      const tsRejects = validate[name](...args) !== null;
      if (canonRejects !== tsRejects && disagreements.length < 5) {
        disagreements.push(`${it.name}(${JSON.stringify(values)}): Canon ${canonRejects ? "rejects" : "accepts"}, TypeScript ${tsRejects ? "rejects" : "accepts"}`);
      }
    }
  }
  return { endpoints, disagreements };
}

describe("validators reject exactly what Canon's requires rejects (1,000 random inputs per endpoint)", () => {
  it("the worked example", async () => {
    const r = await agreement(TODOS, 1000);
    expect(r.endpoints).toBe(2);
    expect(r.disagreements).toEqual([]);
  });

  it("the wide project", async () => {
    const r = await agreement(WIDE, 1000);
    expect(r.endpoints).toBe(5);
    expect(r.disagreements).toEqual([]);
  });

  it("60 random portable rules (and 180 more, for formatting, tsc and eslint)", async () => {
    for (const seed of [7, 99, 31337]) {
      const dir = writeOut(checked(randomRules(seed, 60)));
      expect(prettier(dir), `seed ${seed}`).toBe("");
      expect(tsc(dir), `seed ${seed}`).toBe("");
      expect(await eslint(dir), `seed ${seed}`).toBe("");
    }
    const mods = randomRules(2026, 60);
    const dir = writeOut(checked(mods));
    expect(prettier(dir)).toBe("");
    expect(tsc(dir)).toBe("");
    expect(await eslint(dir)).toBe("");
    const r = await agreement(mods, 1000);
    expect(r.endpoints).toBe(60);
    expect(r.disagreements).toEqual([]);
  });
});
