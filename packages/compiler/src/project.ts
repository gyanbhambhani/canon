/**
 * v0.5: projects. A project is a folder with canon.toml; each .cn file under its source folder is
 * a module named by its path (canon/billing/invoices.cn is billing.invoices). Imports name what
 * they take, `use todos.{NewTodo, Todo}`.
 *
 * Each module is checked as its own program: the items it imports (and the types those items
 * mention) are appended as extern items, which the checkers skip and the printers omit, so every
 * diagnostic and patch belongs to the module's own file. Codegen links the whole project into one
 * program, which works because top-level names are unique across a project (M004).
 */
import type * as A from "./ast.js";
import { walkExprs } from "./ast.js";
import { analyze, makePatch, parseCanonical, programText, type Analysis, type CheckResult } from "./check.js";
import { routeKey } from "./api.js";
import { CanonError, diag, type Diagnostic } from "./diagnostics.js";
import { withFeatures, type CompileOptions } from "./features.js";
import { cmpStr, normalize } from "./normalize.js";

export interface ModuleSource {
  /** Dotted module name, from moduleName(). */
  name: string;
  /** The path shown in diagnostics and patches. */
  path: string;
  src: string;
}

export interface ProjectModule extends ModuleSource {
  analysis: Analysis;
  result: CheckResult;
}

export interface ProjectResult {
  ok: boolean;
  /** Every module, dependencies before dependents (cycles broken by name order). */
  modules: ProjectModule[];
}

/** `billing/invoices.cn` (relative to the source folder) is `billing.invoices`. */
export function moduleName(relPath: string): string {
  return relPath.replace(/\\/g, "/").replace(/\.cn$/, "").split("/").filter((s) => s !== "").join(".");
}

type Decl = A.Fn | A.RecordType | A.SumType | A.Table;

interface Owner {
  module: string;
  item: Decl;
}

const isDecl = (it: A.Item): it is Decl =>
  it.k === "Fn" || it.k === "RecordType" || it.k === "SumType" || it.k === "Table";

const declKind = (it: Decl) =>
  it.k === "Fn" ? (it.route ? "api fn" : "fn") : it.k === "Table" ? "table" : "type";

/** Type names a type expression mentions. */
function typeNames(te: A.TypeExpr, out: Set<string>) {
  if (te.k === "TName") {
    out.add(te.name);
    for (const a of te.args) typeNames(a, out);
  } else if (te.k === "TFn") {
    for (const p of te.params) typeNames(p, out);
    typeNames(te.ret, out);
  } else {
    for (const p of te.items) typeNames(p, out);
  }
}

/** The tables named by `store(...)` effects. */
export function storeTables(effects: string[]): string[] {
  return effects.flatMap((e) => {
    const m = /^store\((.+)\)$/.exec(e);
    return m ? [m[1]] : [];
  });
}

/** An imported item as this module sees it: signature only, marked extern. */
function externOf(it: Decl): A.Item {
  if (it.k === "Fn") return { ...it, body: [], requires: null, ensures: null, extern: true };
  return { ...it, extern: true };
}

export function checkProject(sources: ModuleSource[], opts: CompileOptions = {}): ProjectResult {
  return withFeatures(opts.features, () => checkProjectInner(sources, opts));
}

function checkProjectInner(sources: ModuleSource[], opts: CompileOptions): ProjectResult {
  const sorted = [...sources].sort((a, b) => cmpStr(a.name, b.name));
  const progs = new Map<string, A.Program | null>();
  for (const m of sorted) {
    try {
      progs.set(m.name, parseCanonical(m.src).prog);
    } catch (e) {
      if (!(e instanceof CanonError)) throw e;
      progs.set(m.name, null);
    }
  }
  const extra = new Map<string, Diagnostic[]>(sorted.map((m) => [m.name, []]));
  const report = (module: string, d: Diagnostic) => extra.get(module)!.push(d);

  // -- top-level names are unique across the project (M004)
  const owners = new Map<string, Owner>();
  const variantOwner = new Map<string, { module: string; type: A.SumType }>();
  for (const m of sorted) {
    for (const it of progs.get(m.name)?.items ?? []) {
      if (!isDecl(it)) continue;
      const prev = owners.get(it.name);
      if (prev && prev.module !== m.name) {
        report(m.name, diag("M004",
          `${declKind(it)} ${it.name} is already defined in module ${prev.module}; top-level names are unique across a project`,
          it.line, it.col, { data: { other: prev.module } }));
        continue;
      }
      if (!prev) owners.set(it.name, { module: m.name, item: it });
      if (it.k === "SumType") {
        for (const [vn] of it.variants) {
          const pv = variantOwner.get(vn);
          if (pv && pv.module !== m.name) {
            report(m.name, diag("M004",
              `variant ${vn} is already defined in module ${pv.module}; top-level names are unique across a project`,
              it.line, it.col, { data: { other: pv.module } }));
          } else if (!pv) {
            variantOwner.set(vn, { module: m.name, type: it });
          }
        }
      }
    }
  }

  // -- v0.5: two endpoints with one method and path in different modules (A002)
  const routes = new Map<string, { module: string; fn: A.Fn }>();
  for (const m of sorted) {
    for (const it of progs.get(m.name)?.items ?? []) {
      if (it.k !== "Fn" || !it.route) continue;
      const key = routeKey(it.route);
      const prev = routes.get(key);
      if (prev && prev.module !== m.name) {
        report(m.name, diag("A002", `api fn ${it.name}: ${it.route.method} ${it.route.path} is already the route of api fn ${prev.fn.name} in module ${prev.module}`,
          it.line, it.col));
      } else if (!prev) routes.set(key, { module: m.name, fn: it });
    }
  }

  // -- imports: unknown modules and names (M003), and cycles (M002)
  const imported = new Map<string, Map<string, string>>(); // module -> name -> from module
  const edges = new Map<string, { to: string; use: A.Use }[]>();
  for (const m of sorted) {
    const names = new Map<string, string>();
    const out: { to: string; use: A.Use }[] = [];
    for (const it of progs.get(m.name)?.items ?? []) {
      if (it.k !== "Use" || !it.names || it.path[0] === "std") continue;
      const from = it.path.join(".");
      if (!progs.has(from)) {
        report(m.name, diag("M003", `no module ${from} in this project; modules are ${sorted.map((s) => s.name).join(", ")}`,
          it.line, it.col));
        continue;
      }
      out.push({ to: from, use: it });
      for (const n of it.names) {
        const o = owners.get(n);
        if (o && o.module === from) {
          names.set(n, from);
          continue;
        }
        const v = variantOwner.get(n);
        let msg = `module ${from} has no top-level item ${n}`;
        if (v && v.module === from) msg = `${n} is a variant of ${v.type.name}; import the type: use ${from}.{${v.type.name}}`;
        else if (o) msg += `; it is defined in module ${o.module}: use ${o.module}.{${n}}`;
        report(m.name, diag("M003", msg, it.line, it.col, { data: { module: from, name: n } }));
      }
    }
    imported.set(m.name, names);
    edges.set(m.name, out);
  }
  const cycles = findCycles(sorted.map((m) => m.name), edges);
  for (const cycle of cycles) {
    const text = [...cycle, cycle[0]].join(" -> ");
    for (let i = 0; i < cycle.length; i++) {
      const to = cycle[(i + 1) % cycle.length];
      const e = edges.get(cycle[i])!.find((x) => x.to === to)!;
      report(cycle[i], diag("M002", `import cycle: ${text}; move the shared items into a module both can import`,
        e.use.line, e.use.col, { data: { cycle } }));
    }
  }

  // -- check each module with its imports as externs
  const results = new Map<string, ProjectModule>();
  for (const m of sorted) {
    const prog = progs.get(m.name);
    const externs: A.Item[] = [];
    const own = new Set((prog?.items ?? []).filter(isDecl).map((it) => it.name));
    if (prog) {
      const added = new Set<string>();
      const queue = [...imported.get(m.name)!.keys()];
      while (queue.length) {
        const n = queue.shift()!;
        if (added.has(n) || own.has(n)) continue;
        const o = owners.get(n);
        if (!o) continue;
        added.add(n);
        externs.push(externOf(o.item));
        const refs = new Set<string>();
        const it = o.item;
        if (it.k === "Fn") {
          for (const [, t] of it.params) typeNames(t, refs);
          typeNames(it.ret, refs);
          for (const t of storeTables(it.effects)) refs.add(t);
        } else if (it.k === "RecordType") {
          for (const [, t] of it.fields) typeNames(t, refs);
        } else if (it.k === "SumType") {
          for (const [, fs] of it.variants) for (const [, t] of fs) typeNames(t, refs);
        } else {
          refs.add(it.row);
        }
        for (const r of refs) if (owners.has(r)) queue.push(r);
      }
    }
    const analysis = analyze(m.src, m.path, opts, prog ? { externs } : undefined);
    const diags = [...extra.get(m.name)!];
    const replaced = new Set<Diagnostic>();
    if (prog && analysis.prog) {
      diags.push(...visibility(m, prog, imported.get(m.name)!, owners, variantOwner, analysis.result.diagnostics, replaced));
    }
    const all = [...diags, ...analysis.result.diagnostics.filter((d) => !replaced.has(d))];
    const result: CheckResult = { ...analysis.result, ok: !all.some((d) => d.severity === "error"), diagnostics: all };
    results.set(m.name, { ...m, analysis, result });
  }

  const order = topoOrder(sorted.map((m) => m.name), edges);
  const modules = order.map((n) => results.get(n)!);
  return { ok: modules.every((m) => m.result.ok), modules };
}

/**
 * Names a module uses that live in another module but were not imported (M003, with a patch
 * that adds the import). Types reached only through an import's signature are not visible.
 */
function visibility(
  m: ModuleSource,
  prog: A.Program,
  imported: Map<string, string>,
  owners: Map<string, Owner>,
  variantOwner: Map<string, { module: string; type: A.SumType }>,
  checked: Diagnostic[],
  /** Filled with the T002 diagnostics this turns into M003, which the caller drops. */
  replaced: Set<Diagnostic>,
): Diagnostic[] {
  const own = new Set(prog.items.filter(isDecl).map((it) => it.name));
  const ownVariants = new Set(prog.items.flatMap((it) => (it.k === "SumType" ? it.variants.map(([v]) => v) : [])));
  const diags: Diagnostic[] = [];
  const seen = new Set<string>();
  const missing = (name: string, need: string, from: string, pos: A.Pos, what: string) => {
    const key = `${from}.${need}`;
    if (seen.has(key)) return;
    seen.add(key);
    diags.push(diag("M003", `${what} is defined in module ${from}; import it: use ${from}.{${need}}`, pos.line, pos.col, {
      fix: makePatch(m.src, programText(addImport(prog, from, need)), m.path),
      data: { module: from, name: need },
    }));
  };
  const typeRef = (name: string, pos: A.Pos) => {
    if (own.has(name) || imported.has(name)) return;
    const o = owners.get(name);
    if (o && o.module !== m.name && o.item.k !== "Fn" && o.item.k !== "Table") missing(name, name, o.module, pos, `type ${name}`);
  };
  const variantRef = (name: string, pos: A.Pos) => {
    if (ownVariants.has(name)) return;
    const v = variantOwner.get(name);
    if (v && v.module !== m.name && !imported.has(v.type.name)) missing(name, v.type.name, v.module, pos, `variant ${name} (of type ${v.type.name})`);
  };
  const walkType = (te: A.TypeExpr) => {
    if (te.k === "TName") {
      typeRef(te.name, te);
      te.args.forEach(walkType);
    } else if (te.k === "TFn") {
      te.params.forEach(walkType);
      walkType(te.ret);
    } else te.items.forEach(walkType);
  };
  for (const it of prog.items) {
    if (it.k === "RecordType") it.fields.forEach(([, t]) => walkType(t));
    if (it.k === "SumType") it.variants.forEach(([, fs]) => fs.forEach(([, t]) => walkType(t)));
    if (it.k === "Table") typeRef(it.row, it);
    if (it.k === "Fn") {
      it.params.forEach(([, t]) => walkType(t));
      walkType(it.ret);
    }
    if (it.k !== "Fn" && it.k !== "Test") continue;
    const exprs = [...walkExprs(it.body), ...(it.k === "Fn" ? [...walkExprs(it.requires), ...walkExprs(it.ensures)] : [])];
    for (const e of exprs) {
      if (e.k === "Record") typeRef(e.tname, e);
      else if (e.k === "Ctor" || e.k === "PCtor") variantRef(e.name, e);
    }
  }
  // the checker's T002 for the same names: replaced by the M003 above, or turned into one here
  for (const d of checked) {
    const mm = d.code === "T002" ? /^unknown (?:name|function|type|variant) ([A-Za-z_][A-Za-z0-9_]*)\b/.exec(d.message) : null;
    if (!mm) continue;
    const name = mm[1];
    const v = variantOwner.get(name);
    const o = owners.get(name) ?? (v ? { module: v.module, item: v.type } : undefined);
    if (!o || o.module === m.name) continue;
    replaced.add(d);
    const need = v && !owners.has(name) ? v.type.name : name;
    const key = `${o.module}.${need}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diags.push(diag("M003", `${declKind(o.item)} ${name} is defined in module ${o.module}; import it: use ${o.module}.{${need}}`,
      d.line, d.col, {
        fix: makePatch(m.src, programText(addImport(prog, o.module, need)), m.path),
        data: { module: o.module, name: need },
      }));
  }
  return diags;
}

function addImport(prog: A.Program, from: string, name: string): A.Program {
  const path = from.split(".");
  const items = prog.items.map((it) =>
    it.k === "Use" && it.names && it.path.join(".") === from ? { ...it, names: [...it.names, name] } : it);
  if (!items.some((it) => it.k === "Use" && it.names && it.path.join(".") === from)) {
    items.unshift({ k: "Use", path, names: [name], line: 0, col: 0 });
  }
  return normalize({ k: "Program", items });
}

/** Strongly connected components with more than one module, or a module importing itself. */
function findCycles(names: string[], edges: Map<string, { to: string }[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    on.add(v);
    for (const { to } of edges.get(v) ?? []) {
      if (!idx.has(to)) {
        visit(to);
        low.set(v, Math.min(low.get(v)!, low.get(to)!));
      } else if (on.has(to)) {
        low.set(v, Math.min(low.get(v)!, idx.get(to)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        on.delete(w);
        comp.push(w);
      } while (w !== v);
      const self = (edges.get(v) ?? []).some((e) => e.to === v);
      if (comp.length > 1 || self) out.push(orderCycle(comp, edges));
    }
  };
  for (const n of names) if (!idx.has(n)) visit(n);
  return out;
}

/** A cycle's modules in import order, starting from the first by name. */
function orderCycle(comp: string[], edges: Map<string, { to: string }[]>): string[] {
  const set = new Set(comp);
  const start = [...comp].sort(cmpStr)[0];
  const path = [start];
  let cur = start;
  for (;;) {
    const next = (edges.get(cur) ?? []).map((e) => e.to).filter((t) => set.has(t)).sort(cmpStr)
      .find((t) => !path.includes(t));
    if (!next) break;
    path.push(next);
    cur = next;
  }
  return path;
}

/** Dependencies first; ties and cycles broken by module name. */
function topoOrder(names: string[], edges: Map<string, { to: string }[]>): string[] {
  const out: string[] = [];
  const state = new Map<string, number>();
  const visit = (n: string) => {
    if (state.get(n)) return;
    state.set(n, 1);
    for (const { to } of [...(edges.get(n) ?? [])].sort((a, b) => cmpStr(a.to, b.to))) visit(to);
    out.push(n);
  };
  for (const n of [...names].sort(cmpStr)) visit(n);
  return out;
}

/**
 * The whole project as one program, for codegen and `canon test`: every module's items in
 * dependency order, with project imports dropped and std imports merged. Only valid when the
 * project checked clean.
 */
export function linkProject(project: ProjectResult): A.Program {
  const items: A.Item[] = [];
  const std = new Map<string, A.Use>();
  for (const m of project.modules) {
    const prog = m.analysis.prog;
    if (!prog) continue;
    for (const it of prog.items) {
      if ("extern" in it && it.extern) continue;
      if (it.k === "Use") {
        if (!it.names) std.set(it.path.join("."), it);
        continue;
      }
      items.push(it);
    }
  }
  return { k: "Program", items: [...[...std.values()].sort((a, b) => cmpStr(a.path.join("."), b.path.join("."))), ...items] };
}
