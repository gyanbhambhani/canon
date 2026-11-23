/** v0.5: run the generated Python backend with the pinned tools in .venv (pnpm pyenv). */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkProject, generateFastapi, moduleName, type ProjectResult } from "@canon/compiler";

const root = join(__dirname, "..", "..", "..");
const venv = join(root, ".venv", "bin");

/** A tool from .venv; a missing .venv fails the test with the command that creates it. */
export function pyTool(name: string): string {
  const p = join(venv, name);
  if (!existsSync(p)) throw new Error(`.venv/bin/${name} is missing: run \`pnpm pyenv\` to install the Python tools (requirements-dev.txt)`);
  return p;
}

/** Check a fixture project's modules (canon/ under dir). */
export function loadProject(dir: string): ProjectResult {
  const src = join(dir, "canon");
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".cn") ? [join(d, e.name)] : []);
  const mods = walk(src).sort().map((abs) => {
    const rel = abs.slice(src.length + 1);
    return { name: moduleName(rel), path: `canon/${rel}`, src: readFileSync(abs, "utf8") };
  });
  const r = checkProject(mods);
  if (!r.ok) throw new Error(JSON.stringify(r.modules.map((m) => [m.path, m.result.diagnostics]), null, 1));
  return r;
}

/** Generate the backend into a new temp folder: <tmp>/canon_generated and <tmp>/main.py. */
export function buildBackend(project: ProjectResult): string {
  const out = mkdtempSync(join(tmpdir(), "canon-backend-"));
  for (const f of generateFastapi(project)) {
    const p = join(out, "canon_generated", f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.text);
  }
  return out;
}

export function run(tool: string, args: string[], cwd: string, input?: string) {
  const r = spawnSync(pyTool(tool), args, { cwd, encoding: "utf8", input, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** Run a Python script in the backend folder; it prints one JSON value. */
export function py(cwd: string, script: string): unknown {
  const out = execFileSync(pyTool("python"), ["-c", script], {
    cwd, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONWARNINGS: "ignore" },
  });
  return JSON.parse(out.trim().split("\n").pop()!);
}
