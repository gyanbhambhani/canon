/**
 * v0.5: canon.toml. Only the subset Canon needs: [section] headers, `key = "string"`, integers,
 * booleans and # comments. Anything else is a ConfigError naming the line.
 */

export interface CanonConfig {
  project: { name: string; src: string };
  backend: { target: "fastapi"; out: string } | null;
  frontend: { target: "ts-client"; out: string } | null;
}

export class ConfigError extends Error {}

type Value = string | number | boolean;

export function parseToml(text: string): Record<string, Record<string, Value>> {
  const out: Record<string, Record<string, Value>> = {};
  let section: Record<string, Value> | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = stripComment(raw).trim();
    if (line === "") return;
    const where = `canon.toml:${i + 1}`;
    const head = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (head) {
      if (Object.hasOwn(out, head[1])) throw new ConfigError(`${where}: section [${head[1]}] appears twice`);
      section = out[head[1]] = {};
      return;
    }
    const kv = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!kv) throw new ConfigError(`${where}: expected [section] or key = value`);
    if (section === null) throw new ConfigError(`${where}: ${kv[1]} must sit inside a [section]`);
    if (Object.hasOwn(section, kv[1])) throw new ConfigError(`${where}: ${kv[1]} is set twice`);
    section[kv[1]] = value(kv[2].trim(), where);
  });
  return out;
}

function stripComment(line: string): string {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && inStr) i++;
    else if (c === '"') inStr = !inStr;
    else if (c === "#" && !inStr) return line.slice(0, i);
  }
  return line;
}

function value(v: string, where: string): Value {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  const s = /^"((?:[^"\\]|\\.)*)"$/.exec(v);
  if (s) return s[1].replace(/\\(.)/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
  throw new ConfigError(`${where}: values are "strings", integers or true/false`);
}

const KNOWN: Record<string, string[]> = { project: ["name", "src"], backend: ["target", "out"], frontend: ["target", "out"] };

export function readConfig(text: string): CanonConfig {
  const t = parseToml(text);
  for (const [sec, keys] of Object.entries(t)) {
    if (!KNOWN[sec]) throw new ConfigError(`canon.toml: unknown section [${sec}]; the sections are [project], [backend] and [frontend]`);
    for (const k of Object.keys(keys)) {
      if (!KNOWN[sec].includes(k)) throw new ConfigError(`canon.toml: unknown key ${k} in [${sec}]; expected ${KNOWN[sec].join(", ")}`);
    }
  }
  const str = (sec: string, key: string, dflt?: string): string => {
    const v = t[sec]?.[key];
    if (v === undefined) {
      if (dflt !== undefined) return dflt;
      throw new ConfigError(`canon.toml: [${sec}] needs ${key}`);
    }
    if (typeof v !== "string") throw new ConfigError(`canon.toml: [${sec}] ${key} must be a string`);
    return v;
  };
  if (!t.project) throw new ConfigError("canon.toml: needs a [project] section with name");
  const config: CanonConfig = { project: { name: str("project", "name"), src: str("project", "src", "canon") }, backend: null, frontend: null };
  if (t.backend) {
    const target = str("backend", "target", "fastapi");
    if (target !== "fastapi") throw new ConfigError(`canon.toml: [backend] target must be "fastapi"`);
    config.backend = { target, out: str("backend", "out", "backend/canon_generated") };
  }
  if (t.frontend) {
    const target = str("frontend", "target", "ts-client");
    if (target !== "ts-client") throw new ConfigError(`canon.toml: [frontend] target must be "ts-client"`);
    config.frontend = { target, out: str("frontend", "out", "frontend/src/canon") };
  }
  return config;
}
