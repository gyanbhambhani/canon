/**
 * Run client tests (and validation-agreement checks) against a running backend.
 *   tsx harness/client-runner.ts --frontend DIR --base URL [--tests a.ts,b.ts] [--validation task.json]
 * Prints one JSON object: { results: [{ id, tags, passed, error }], validation: [...] }.
 */
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import type { ClientTest, Ctx, Outcome, ValidationSpec } from "./client-api";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const frontend = resolve(arg("frontend")!);
const baseUrl = arg("base")!;
const files = (arg("tests") ?? "").split(",").filter(Boolean);
const validationFile = arg("validation");
const skip = new Set((arg("skip") ?? "").split(",").filter(Boolean));

class Failure extends Error {}

let counter = 0;
const ctx: Ctx = {
  baseUrl,
  async feature(name) {
    return import(pathToFileURL(join(frontend, "src", "features", `${name}.ts`)).href);
  },
  async http(method, path, body) {
    const r = await fetch(baseUrl + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  },
  unique(prefix) {
    counter++;
    return `${prefix}${process.pid}x${counter}`;
  },
  equal(actual, expected, what = "value") {
    if (!isDeepStrictEqual(actual, expected)) {
      throw new Failure(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  ok(o: Outcome, what = "outcome") {
    if (!o || o.ok !== true) throw new Failure(`${what}: expected ok, got ${JSON.stringify(o)}`);
    return o.value as any;
  },
  fails(o: Outcome, kind, what = "outcome") {
    if (!o || o.ok !== false || o.error?.kind !== kind) throw new Failure(`${what}: expected error ${kind}, got ${JSON.stringify(o)}`);
    return o.error as Record<string, unknown>;
  },
};

// -- seeded generators for validation agreement
let seed = 2026;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const GENS: Record<string, () => unknown> = {
  email: () => pick(["ada@example.com", "a@b.co", "bad", "no@dot", "x y@z.io", "@z.io", "u@v.w", ""]) + (rand() < 0.5 ? "" : String(Math.floor(rand() * 1e6))),
  name: () => pick(["Ada", "", "   ", " Bo ", " ", "Grace Hopper", "x".repeat(Math.floor(rand() * 60)), "Zoë"]),
  password: () => "p".repeat(Math.floor(rand() * 14)),
  string: () => pick(["", "a", "abc", "  ", "hello world", "é", "x".repeat(Math.floor(rand() * 50))]),
  sku: () => pick(["", "a", "ab", "abc", "sku-1", "toolbox"]) + (rand() < 0.5 ? "" : String(Math.floor(rand() * 1e6))),
  int: () => Math.floor(rand() * 200) - 50,
  small: () => Math.floor(rand() * 20) - 5,
  bool: () => rand() < 0.5,
};

function fill(template: unknown, values: Record<string, unknown>): unknown {
  if (typeof template === "string" && template.startsWith("$")) return values[template.slice(1)];
  if (Array.isArray(template)) return template.map((x) => fill(x, values));
  if (template && typeof template === "object") return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, fill(v, values)]));
  return template;
}

async function validation(spec: ValidationSpec) {
  const mod = await ctx.feature(spec.feature);
  const fn = Object.values(mod)[0];
  const realFetch = globalThis.fetch;
  let agree = 0;
  let clientRejects = 0;
  let serverRejects = 0;
  const samples = spec.samples ?? 1000;
  const disagreements: unknown[] = [];
  for (let i = 0; i < samples; i++) {
    // a path parameter cannot be "", ".", ".." or contain "/" (no URL carries it): draw again
    const inPath = [...spec.request.path.matchAll(/\$(\w+)/g)].map((m) => m[1]);
    let values: Record<string, unknown> = {};
    for (let tries = 0; tries < 100; tries++) {
      values = {};
      for (const a of spec.args) values[a.name] = (GENS[a.gen] ?? GENS.string)();
      if (inPath.every((n) => !["", ".", ".."].includes(String(values[n])) && !String(values[n]).includes("/"))) break;
    }
    // the client's own decision: rejected before any request
    let sent = 0;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
      sent++;
      return realFetch(...a);
    }) as typeof fetch;
    let out: Outcome;
    try {
      out = await fn(baseUrl, ...spec.args.map((a) => values[a.name]));
    } catch (e) {
      out = { ok: false, error: { kind: "Threw", message: String(e) } };
    } finally {
      globalThis.fetch = realFetch;
    }
    const clientSays = !(out.ok === false && out.error?.kind === "ValidationError" && sent === 0);
    // the server's decision on the same input
    let path = spec.request.path.replace(/\$(\w+)/g, (_, n: string) => encodeURIComponent(String(values[n])));
    if (spec.request.query) {
      const q = new URLSearchParams(Object.entries(fill(spec.request.query, values) as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
      path += `?${q}`;
    }
    const r = await ctx.http(spec.request.method, path, spec.request.body === undefined ? undefined : fill(spec.request.body, values));
    const serverSays = r.status !== 422;
    if (!clientSays) clientRejects++;
    if (!serverSays) serverRejects++;
    if (clientSays === serverSays) agree++;
    else if (disagreements.length < 5) disagreements.push({ values, client: clientSays, server: serverSays });
  }
  return { feature: spec.feature, samples, agreement: agree / samples, clientRejects, serverRejects, disagreements };
}

const results: { id: string; tags: string[]; passed: boolean; error?: string }[] = [];
for (const f of files) {
  let tests: ClientTest[];
  try {
    tests = (await import(pathToFileURL(resolve(f)).href)).tests;
  } catch (e) {
    results.push({ id: `${f}: load`, tags: ["client"], passed: false, error: String(e) });
    continue;
  }
  for (const t of tests) {
    if (skip.has(t.id)) continue;
    try {
      await t.run(ctx);
      results.push({ id: t.id, tags: ["client", ...t.tags], passed: true });
    } catch (e) {
      results.push({ id: t.id, tags: ["client", ...t.tags], passed: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
}
const specs: ValidationSpec[] = validationFile ? (JSON.parse(readFileSync(validationFile, "utf8")).validation ?? []) : [];
const agreements = [];
for (const s of specs) {
  try {
    agreements.push(await validation(s));
  } catch (e) {
    agreements.push({ feature: s.feature, error: String(e) });
  }
}
process.stdout.write(JSON.stringify({ results, validation: agreements }) + "\n");
