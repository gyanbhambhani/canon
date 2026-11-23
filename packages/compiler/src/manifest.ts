/**
 * v0.5: `canon manifest`, every endpoint with its route, effects (tables and hosts) and
 * validation rules: a permission list a person can read before the code runs.
 */
import type * as A from "./ast.js";
import { isExtern } from "./ast.js";
import { diag, type Diagnostic } from "./diagnostics.js";
import { withFeatures } from "./features.js";
import { Printer } from "./printer.js";

export interface Endpoint {
  method: A.Route["method"];
  path: string;
  function: string;
  module: string | null;
  effects: string[];
  tables: string[];
  /** Hosts from net(<host>); "*" when the endpoint may call any host (plain net). */
  hosts: string[];
  /** The requires clause in canonical brace text, or null. */
  checks: string | null;
}

export interface Manifest {
  endpoints: Endpoint[];
  warnings: Diagnostic[];
}

/**
 * The rule text: canonical brace syntax whatever the source surface, so the manifest, the 422
 * response's `rule` and the generated client say the same thing.
 */
export function ruleText(e: A.Expr): string {
  return withFeatures({ py: false }, () => new Printer().ex(e, 1));
}

export function manifest(modules: { module: string | null; prog: A.Program }[]): Manifest {
  const endpoints: Endpoint[] = [];
  const warnings: Diagnostic[] = [];
  for (const { module, prog } of modules) {
    for (const it of prog.items) {
      if (it.k !== "Fn" || !it.route || isExtern(it)) continue;
      const tables = it.effects.flatMap((e) => (e.startsWith("store(") ? [e.slice(6, -1)] : []));
      const anyHost = it.effects.includes("net");
      const hosts = anyHost ? ["*"] : it.effects.flatMap((e) => (e.startsWith("net(") ? [e.slice(4, -1)] : []));
      if (anyHost) {
        warnings.push(diag("W010",
          `api fn ${it.name} may call any host (effects: net); name the hosts it calls, like net(api.example.com)`,
          it.line, it.col, { severity: "warning", data: { function: it.name, module } }));
      }
      endpoints.push({
        method: it.route.method, path: it.route.path, function: it.name, module, effects: it.effects,
        tables, hosts, checks: it.requires ? ruleText(it.requires) : null,
      });
    }
  }
  return { endpoints, warnings };
}

/** The text table: one line per endpoint, columns padded to the widest entry plus three spaces. */
export function manifestText(m: Manifest): string {
  const w = (f: (e: Endpoint) => string) => Math.max(0, ...m.endpoints.map((e) => f(e).length));
  const effects = (e: Endpoint) => (e.effects.length ? e.effects.join(", ") : "pure");
  const wm = w((e) => e.method);
  const wp = w((e) => e.path);
  const wf = w((e) => e.function);
  const we = w(effects);
  const lines = m.endpoints.map((e) => {
    const head = `${e.method.padEnd(wm)} ${e.path.padEnd(wp + 3)}${e.function.padEnd(wf + 3)}`;
    return e.checks ? `${head}${effects(e).padEnd(we + 3)}checks: ${e.checks}` : `${head}${effects(e)}`;
  });
  if (!lines.length) lines.push("no endpoints (an endpoint is an api fn with a route)");
  for (const d of m.warnings) lines.push(`warning ${d.code}: ${d.message}`);
  return lines.join("\n") + "\n";
}
