/**
 * VA-1's three arms: preparing a working copy, building it, and running the arm's own checks.
 * Adapted from research/fs1/harness/arms.ts (FS-1 is not edited; its harness is copied and changed).
 *   hand   : FastAPI with hand-written checks; hand-written TypeScript client validation
 *   schema : FastAPI with the constraints in the Pydantic models; TypeScript validators generated
 *            from the OpenAPI schema (openapi-typescript 7.13.0 for types, ajv 8.17.1 for validators)
 *   canon  : `api fn ... requires:`, compiled by `canon build`
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type Arm = "hand" | "schema" | "canon";
export const ARMS: Arm[] = ["hand", "schema", "canon"];

export const VA1 = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = join(VA1, "..", "..");
export const PY = join(VA1, ".venv", "bin");
export const CANON = join(ROOT, "packages", "cli", "dist", "index.js");
const ESLINT = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

const SKIP = new Set(["node_modules", "__pycache__", ".mypy_cache", ".ruff_cache", ".pytest_cache"]);

function copyTree(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (SKIP.has(name) || name.endsWith(".db")) continue;
    const a = join(from, name);
    const b = join(to, name);
    if (statSync(a).isDirectory()) copyTree(a, b);
    else cpSync(a, b);
  }
}

/** A fresh working copy of an arm's starter, with overlays applied in order (a file DELETE lists paths to remove). */
export function prepare(arm: Arm, dest: string, overlays: string[] = []): string {
  rmSync(dest, { recursive: true, force: true });
  copyTree(join(VA1, "starters", arm), dest);
  for (const o of overlays) {
    if (!existsSync(o)) continue;
    copyTree(o, dest);
    const del = join(o, "DELETE");
    if (existsSync(del)) {
      rmSync(join(dest, "DELETE"), { force: true });
      for (const p of readFileSync(del, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)) rmSync(join(dest, p), { recursive: true, force: true });
    }
  }
  return dest;
}

export interface Step {
  name: string;
  ok: boolean;
  output: string;
}

function step(name: string, cmd: string, args: string[], cwd: string, env: Record<string, string> = {}): Step {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 300_000 });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  return { name, ok: r.status === 0, output: output.length > 6000 ? output.slice(0, 6000) + "\n[...]" : output };
}

/** Generate code: canon build (canon), the OpenAPI types and validators (schema), nothing (hand). */
export function build(arm: Arm, dir: string): Step {
  if (arm === "canon") return step("canon build", process.execPath, [CANON, "build"], dir);
  if (arm === "schema") return step("generate client", process.execPath, ["generate-client.mjs"], dir, { VA1_PYTHON: join(PY, "python") });
  return { name: "build", ok: true, output: "" };
}

/**
 * The arm's own checks, with automatic fixes applied first (the same rule in every arm):
 *   hand, schema: ruff --fix and ruff format, mypy --strict, tsc --noEmit, eslint --fix
 *   canon: canon check --fix --write, canon check --json, canon test, tsc --noEmit, eslint --fix
 */
export function checks(arm: Arm, dir: string): { ok: boolean; steps: Step[] } {
  const steps: Step[] = [];
  const backend = join(dir, "backend");
  const frontend = join(dir, "frontend");
  if (arm === "canon") {
    step("canon fix", process.execPath, [CANON, "check", "--fix", "--write"], dir);
    steps.push(step("canon check", process.execPath, [CANON, "check", "--json"], dir));
    steps.push(step("canon test", process.execPath, [CANON, "test"], dir));
  } else {
    step("ruff fix", join(PY, "ruff"), ["check", "--isolated", "--fix", "--quiet", "."], backend);
    step("ruff format", join(PY, "ruff"), ["format", "--isolated", "--quiet", "."], backend);
    steps.push(step("ruff check", join(PY, "ruff"), ["check", "--isolated", "--output-format", "concise", "."], backend));
    const files = readdirSync(backend).filter((n) => n.endsWith(".py"));
    steps.push(step("mypy --strict", join(PY, "mypy"), ["--strict", "--no-incremental", ...files], backend));
  }
  steps.push(step("tsc --noEmit", process.execPath, [TSC, "--noEmit", "-p", "."], frontend));
  step("eslint fix", process.execPath, [ESLINT, "--fix", "src"], frontend);
  steps.push(step("eslint", process.execPath, [ESLINT, "src"], frontend));
  return { ok: steps.every((s) => s.ok), steps };
}

/** Files of a working copy, relative, for listing to an agent. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d).sort()) {
      if (SKIP.has(n) || n.endsWith(".db") || n === "openapi.json") continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out;
}
