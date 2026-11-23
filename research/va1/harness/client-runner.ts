/**
 * Client side of the hidden suite, against a running backend:
 *   1. wiring: the feature accepts a valid input and returns what the server returns for it, and
 *      a request the server rejects does not come back as a success;
 *   2. validation agreement on the seeded near-boundary inputs of harness/generator.ts.
 *
 *   tsx harness/client-runner.ts --frontend DIR --base URL --task task.json [--samples 1000] [--seed 2026]
 * Prints one JSON object: { wiring, agreement }.
 */
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { generate, mulberry32, evalValue, hashString, type GenSpec } from "./generator";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const frontend = resolve(arg("frontend")!);
const baseUrl = arg("base")!;
const task = JSON.parse(readFileSync(arg("task")!, "utf8")) as GenSpec & {
  route: { method: string; path: string };
  feature: { module: string; fn: string };
};
const samples = Number(arg("samples") ?? 1000);
const seed = Number(arg("seed") ?? 2026);

interface Outcome {
  ok: boolean;
  value?: unknown;
  error?: { kind: string };
}

async function http(body: unknown): Promise<{ status: number; body: unknown }> {
  const r = await fetch(baseUrl + task.route.path, {
    method: task.route.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const realFetch = globalThis.fetch;
/** Call the feature, counting the requests it sends. */
async function callFeature(fn: (...a: unknown[]) => Promise<Outcome>, input: unknown): Promise<{ out: Outcome; sent: number }> {
  let sent = 0;
  globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
    sent++;
    return realFetch(...a);
  }) as typeof fetch;
  try {
    return { out: await fn(baseUrl, input), sent };
  } catch (e) {
    return { out: { ok: false, error: { kind: "Threw", message: String(e) } as { kind: string } }, sent };
  } finally {
    globalThis.fetch = realFetch;
  }
}

let fn: (...a: unknown[]) => Promise<Outcome>;
let wiring: { ok: boolean; error?: string };
try {
  const mod = await import(pathToFileURL(join(frontend, "src", "features", `${task.feature.module}.ts`)).href);
  fn = mod[task.feature.fn];
  if (typeof fn !== "function") throw new Error(`${task.feature.module}.ts does not export ${task.feature.fn}`);
  const rand = mulberry32(seed ^ hashString(task.id) ^ 7);
  const v: Record<string, unknown> = {};
  for (const [k, e] of Object.entries(task.base)) v[k] = evalValue(e, v, rand);
  const truth = await http(v);
  const { out, sent } = await callFeature(fn, v);
  if (truth.status !== 200) wiring = { ok: false, error: `the server answered ${truth.status} to a valid input` };
  else if (!out.ok || sent !== 1) wiring = { ok: false, error: `a valid input: expected ok after one request, got ${JSON.stringify(out)} after ${sent}` };
  else if (!isDeepStrictEqual(out.value, truth.body)) wiring = { ok: false, error: `a valid input: the feature returned ${JSON.stringify(out.value)}, the server ${JSON.stringify(truth.body)}` };
  else wiring = { ok: true };
} catch (e) {
  wiring = { ok: false, error: `cannot load the feature: ${String(e).slice(0, 400)}` };
  fn = async () => ({ ok: false, error: { kind: "Threw" } });
}

interface Cat {
  n: number;
  agree: number;
  /** the client says valid and the server answers 422: a request that will bounce */
  bounce: number;
  /** the client says invalid and the server answers 2xx: a legitimate request blocked */
  block: number;
}
const byCategory: Record<string, Cat> = {};
/** what the server answered, per category (ground truth for testing the generator) */
const server: Record<string, { n: number; ok: number; invalid: number; other: number }> = {};
let agree = 0;
let bounce = 0;
let block = 0;
let serverOther = 0;
let clientRejects = 0;
let serverRejects = 0;
const disagreements: unknown[] = [];
for (const s of generate(task, seed, samples)) {
  const { out, sent } = await callFeature(fn, s.input);
  const clientValid = !(out.ok === false && out.error?.kind === "ValidationError" && sent === 0);
  const r = await http(s.input);
  const cat = (byCategory[s.category] ??= { n: 0, agree: 0, bounce: 0, block: 0 });
  cat.n++;
  const sv = (server[s.category] ??= { n: 0, ok: 0, invalid: 0, other: 0 });
  sv.n++;
  if (r.status >= 200 && r.status < 300) sv.ok++;
  else if (r.status === 422) sv.invalid++;
  else sv.other++;
  if (!clientValid) clientRejects++;
  if (r.status === 422) serverRejects++;
  if (r.status !== 422 && (r.status < 200 || r.status >= 300)) serverOther++;
  const serverValid = r.status >= 200 && r.status < 300;
  const serverInvalid = r.status === 422;
  if (clientValid && serverInvalid) {
    bounce++;
    cat.bounce++;
  } else if (!clientValid && serverValid) {
    block++;
    cat.block++;
  } else if ((clientValid && serverValid) || (!clientValid && serverInvalid)) {
    agree++;
    cat.agree++;
  }
  if (!((clientValid && serverValid) || (!clientValid && serverInvalid)) && disagreements.length < 8) {
    disagreements.push({ input: s.input, category: s.category, client: clientValid, status: r.status });
  }
}
process.stdout.write(
  JSON.stringify({ wiring, agreement: { samples, agree, bounce, block, serverOther, clientRejects, serverRejects, byCategory, server, disagreements } }) + "\n",
);
