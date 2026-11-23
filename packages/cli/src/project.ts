/** v0.5: finding and loading a project (a folder with canon.toml) from disk. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ConfigError, moduleName, readConfig, readSource, type CanonConfig, type ModuleSource } from "@canon/compiler";

export interface Project {
  root: string;
  config: CanonConfig;
  /** Absolute path of the source folder. */
  srcDir: string;
  /** Every module; `path` is relative to the current directory, for diagnostics. */
  modules: (ModuleSource & { abs: string })[];
}

export class ProjectError extends Error {}

/** The nearest folder at or above `from` holding canon.toml. */
export function findProjectRoot(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "canon.toml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function listCn(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listCn(p));
    else if (name.endsWith(".cn")) out.push(p);
  }
  return out;
}

export function loadProject(root: string): Project {
  let config: CanonConfig;
  try {
    config = readConfig(readFileSync(join(root, "canon.toml"), "utf8"));
  } catch (e) {
    if (e instanceof ConfigError) throw new ProjectError(`${relative(process.cwd(), join(root, "canon.toml")) || "canon.toml"}: ${e.message.replace(/^canon\.toml:?\s*/, "")}`);
    throw e;
  }
  const srcDir = resolve(root, config.project.src);
  if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
    throw new ProjectError(`canon.toml: the source folder ${config.project.src}/ does not exist`);
  }
  const modules = listCn(srcDir).map((abs) => ({
    name: moduleName(relative(srcDir, abs)),
    path: relative(process.cwd(), abs) || abs,
    abs,
    src: readSource(readFileSync(abs, "utf8")),
  }));
  if (modules.length === 0) throw new ProjectError(`canon.toml: no .cn files under ${config.project.src}/`);
  return { root, config, srcDir, modules };
}

/** The project a file belongs to: canon.toml above it, with the file inside the source folder. */
export function projectOfFile(file: string): Project | null {
  const abs = resolve(file);
  const root = findProjectRoot(dirname(abs));
  if (!root) return null;
  const project = loadProject(root);
  return abs.startsWith(project.srcDir + sep) ? project : null;
}
