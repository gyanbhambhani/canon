/**
 * JavaScript code generation. The output is the body of a function that receives the
 * runtime as `$rt` (from @canon/runtime) and returns { main, tests, types }; wrap it with
 * `asModule` for an ES2022 module.
 *
 * Int and Float are both JS numbers, so the checker's types decide the operation: Int
 * arithmetic is overflow-checked and `/` truncates; to_string receives a type descriptor.
 */
import type * as A from "./ast.js";
import { analyze, type CheckResult } from "./check.js";
import { prune, resolve, type Type, type TypeInfo } from "./types.js";

type TD = string | { L: TD } | { M: [TD, TD] } | { T: TD[] } | { F: 1 } | { C: string; a: TD[] } | { P: number };

interface Scope {
  vars: Map<string, { js: string; mutable: boolean }>;
}

const RESERVED_SAFE = (name: string) => `v_${name}`;

function posOf(e: A.Expr): { line: number; col: number } {
  let cur: A.Expr = e;
  while ((cur.line === 0 || cur.line === undefined) && cur.k === "Binary") cur = cur.left;
  return { line: cur.line ?? 0, col: cur.col ?? 0 };
}

export function typeToTD(t: Type, params: Map<string, number> = new Map()): TD {
  t = prune(t);
  switch (t.t) {
    case "con":
      if (["Int", "Float", "String", "Bool", "Unit"].includes(t.name)) return t.name;
      if (t.name === "List") return { L: typeToTD(t.args[0], params) };
      if (t.name === "Map") return { M: [typeToTD(t.args[0], params), typeToTD(t.args[1], params)] };
      return { C: t.name, a: t.args.map((a) => typeToTD(a, params)) };
    case "tuple":
      return { T: t.items.map((i) => typeToTD(i, params)) };
    case "fn":
      return { F: 1 };
    case "rigid":
      return params.has(t.name) ? { P: params.get(t.name)! } : "?";
    case "var":
      return "?";
  }
}

function typeExprToTD(te: A.TypeExpr, params: string[]): TD {
  switch (te.k) {
    case "TFn":
      return { F: 1 };
    case "TTuple":
      return { T: te.items.map((i) => typeExprToTD(i, params)) };
    case "TName": {
      const i = params.indexOf(te.name);
      if (i >= 0) return { P: i };
      if (["Int", "Float", "String", "Bool", "Unit"].includes(te.name)) return te.name;
      if (te.name === "List") return { L: typeExprToTD(te.args[0], params) };
      if (te.name === "Map") return { M: [typeExprToTD(te.args[0], params), typeExprToTD(te.args[1], params)] };
      return { C: te.name, a: te.args.map((a) => typeExprToTD(a, params)) };
    }
  }
}

const kindOf = (info: TypeInfo, e: A.Expr): string | null => {
  const t = info.types.get(e);
  if (!t) return null;
  const r = prune(t);
  return r.t === "con" ? r.name : null;
};

export function generate(prog: A.Program, info: TypeInfo): string {
  const out: string[] = ['"use strict";'];
  const scopes: Scope[] = [];
  let tmp = 0;
  const fresh = (base: string) => `${base}$${tmp++}`;
  let counter = 0;

  const lookup = (name: string) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const v = scopes[i].vars.get(name);
      if (v) return v;
    }
    return undefined;
  };
  const declare = (name: string, mutable = false): string => {
    const js = `${RESERVED_SAFE(name)}_${counter++}`;
    scopes[scopes.length - 1].vars.set(name, { js, mutable });
    return js;
  };
  const withScope = <T>(f: () => T): T => {
    scopes.push({ vars: new Map() });
    try {
      return f();
    } finally {
      scopes.pop();
    }
  };

  // ---- expressions
  const builtinValue = (name: string, pos: { line: number; col: number }): string => {
    // a built-in used as a value: wrap it so it receives its position arguments
    return `((...a) => $rt.std.${name}(${pos.line}, ${pos.col}, ...a))`;
  };

  const ex = (e: A.Expr): string => {
    switch (e.k) {
      case "Int":
        return e.value;
      case "Float":
        return Number.isFinite(e.value) ? String(e.value) : "NaN";
      case "Str":
        return e.raw;
      case "Bool":
        return e.value ? "true" : "false";
      case "Hole":
        return `$rt.trap("H001", "hole reached at runtime", ${e.line}, ${e.col})`;
      case "Name": {
        const name = e.path[0];
        const local = lookup(name);
        if (local) return local.js;
        const how = info.names.get(e);
        if (how === "builtin") return builtinValue(name, e);
        return `f_${name}`;
      }
      case "Ctor": {
        return `{ $t: ${JSON.stringify(e.name)} }`;
      }
      case "Call":
        return call(e);
      case "FieldGet": {
        const obj = ex(e.obj);
        if (/^\d+$/.test(e.name)) return `${obj}[${e.name}]`;
        return `${obj}[${JSON.stringify(e.name)}]`;
      }
      case "Unary": {
        if (e.op === "not") return `(!${ex(e.operand)})`;
        const k = kindOf(info, e.operand);
        if (k === "Int") return `$rt.ck(-${paren(ex(e.operand))}, ${e.line}, ${e.col})`;
        return `(-${paren(ex(e.operand))})`;
      }
      case "Binary":
        return binary(e);
      case "Try":
        return `$rt.tryv(${ex(e.expr)})`;
      case "Lambda":
        return lambda(e);
      case "ListLit":
      case "TupleLit":
        return `[${e.items.map(ex).join(", ")}]`;
      case "Record": {
        const fields = e.fields.map(([n, v]) => `[${JSON.stringify(n)}]: ${ex(v)}`);
        return `{ $t: ${JSON.stringify(e.tname)}${fields.length ? ", " + fields.join(", ") : ""} }`;
      }
      case "Match":
        return match(e);
    }
  };

  const paren = (s: string) => `(${s})`;

  const binary = (e: A.Binary): string => {
    const { line, col } = posOf(e);
    const l = ex(e.left);
    const r = ex(e.right);
    switch (e.op) {
      case "and":
        return `(${l} && ${r})`;
      case "or":
        return `(${l} || ${r})`;
      case "==":
        return `$rt.eq(${l}, ${r})`;
      case "!=":
        return `(!$rt.eq(${l}, ${r}))`;
    }
    const k = kindOf(info, e.left) ?? kindOf(info, e.right);
    if (["<", "<=", ">", ">="].includes(e.op)) {
      if (k === "String") return `($rt.scmp(${l}, ${r}) ${e.op} 0)`;
      return `(${l} ${e.op} ${r})`;
    }
    if (k === "Int") {
      if (e.op === "/") return `$rt.idiv(${l}, ${r}, ${line}, ${col})`;
      if (e.op === "%") return `$rt.imod(${l}, ${r}, ${line}, ${col})`;
      return `$rt.ck(${l} ${e.op} ${r}, ${line}, ${col})`;
    }
    if (e.op === "/") return `$rt.fdiv(${l}, ${r}, ${line}, ${col})`;
    if (e.op === "%") return `$rt.fmod(${l}, ${r}, ${line}, ${col})`;
    return `(${l} ${e.op} ${r})`;
  };

  const call = (e: A.Call): string => {
    const kind = info.calls.get(e);
    if (e.callee.k === "Ctor") {
      const c = info.ctors.get(e.callee.name);
      const fields = (c?.fields ?? []).map(([n], i) => `[${JSON.stringify(n)}]: ${ex(e.args[i])}`);
      return `{ $t: ${JSON.stringify(e.callee.name)}${fields.length ? ", " + fields.join(", ") : ""} }`;
    }
    const name = e.callee.path[0];
    const args = e.args.map(ex);
    if (kind === "local") return `${lookup(name)!.js}(${args.join(", ")})`;
    if (kind === "builtin") {
      if (name === "to_string") {
        const t = info.types.get(e.args[0]);
        const td = t ? typeToTD(resolve(t)) : "?";
        return `$rt.std.to_string(${e.line}, ${e.col}, ${args[0]}, ${JSON.stringify(td)})`;
      }
      return `$rt.std.${name}(${[String(e.line), String(e.col), ...args].join(", ")})`;
    }
    return `($rt.at(${e.line}, ${e.col}), f_${name}(${args.join(", ")}))`;
  };

  const lambda = (e: A.Lambda): string => {
    return withScope(() => {
      // lambdas capture values, never variables: snapshot captured vars
      const captured = new Set<string>();
      const collect = (x: unknown) => {
        if (Array.isArray(x)) return x.forEach(collect);
        if (!x || typeof x !== "object") return;
        const n = x as A.Expr;
        if (n.k === "Name" && n.path.length === 1 && !e.params.includes(n.path[0])) {
          const b = lookup(n.path[0]);
          if (b?.mutable) captured.add(n.path[0]);
        }
        for (const v of Object.values(x)) if (v && typeof v === "object") collect(v);
      };
      collect(e.body);
      const snap = [...captured].map((n) => [lookup(n)!.js, n] as const);
      for (const [, n] of snap) declare(n);
      const snapParams = snap.map(([, n]) => lookup(n)!.js);
      const params = e.params.map((p) => declare(p));
      let fn: string;
      if (info.unpack.has(e)) {
        const t = fresh("t");
        fn = `((${t}) => { const [${params.join(", ")}] = ${t}; return ${ex(e.body)}; })`;
      } else {
        fn = `((${params.join(", ")}) => ${paren(ex(e.body))})`;
      }
      if (snap.length) return `((${snapParams.join(", ")}) => ${fn})(${snap.map(([js]) => js).join(", ")})`;
      return fn;
    });
  };

  /** Conditions and bindings that make pattern p match the JS value in `subj`. */
  const patternTest = (p: A.Pattern, subj: string, conds: string[], binds: [string, string][]) => {
    switch (p.k) {
      case "PWild":
        return;
      case "PBind":
        binds.push([p.name, subj]);
        return;
      case "PLit":
        conds.push(`${subj} === ${ex(p.lit)}`);
        return;
      case "PCtor": {
        conds.push(`${subj}.$t === ${JSON.stringify(p.name)}`);
        const c = info.ctors.get(p.name);
        p.args.forEach((a, i) => {
          const field = c?.fields[i]?.[0] ?? String(i);
          patternTest(a, `${subj}[${JSON.stringify(field)}]`, conds, binds);
        });
        return;
      }
      case "PTuple":
        p.items.forEach((a, i) => patternTest(a, `${subj}[${i}]`, conds, binds));
        return;
    }
  };

  const match = (e: A.Match): string => {
    const s = fresh("m");
    const arms = e.arms.map(([p, v]) =>
      withScope(() => {
        const conds: string[] = [];
        const binds: [string, string][] = [];
        patternTest(p, s, conds, binds);
        const decls = binds.map(([n, js]) => `const ${declare(n)} = ${js};`).join(" ");
        const body = `${decls} return ${ex(v)};`;
        return conds.length ? `if (${conds.join(" && ")}) { ${body} }` : `{ ${body} }`;
      }));
    return `((${s}) => { ${arms.join(" ")} throw new Error("match fell through"); })(${ex(e.subject)})`;
  };

  // ---- statements
  const stmts = (body: A.Stmt[], indent: string): string[] => withScope(() => body.flatMap((s) => stmt(s, indent)));

  const stmt = (s: A.Stmt, ind: string): string[] => {
    switch (s.k) {
      case "Comment":
        return [];
      case "Let": {
        const value = ex(s.value);
        return [`${ind}${s.mutable ? "let" : "const"} ${declare(s.name, s.mutable)} = ${value};`];
      }
      case "Set": {
        // set p.a.b = v rebinds p to an updated copy
        const path: string[] = [];
        let root: A.Expr = s.target;
        while (root.k === "FieldGet") {
          path.unshift(root.name);
          root = root.obj;
        }
        const v = lookup((root as A.Name).path[0])!.js;
        const build = (base: string, i: number): string => {
          if (i === path.length) return ex(s.value);
          const key = JSON.stringify(path[i]);
          const inner = `${base}[${key}]`;
          return `{ ...${base}, [${key}]: ${build(inner, i + 1)} }`;
        };
        return [`${ind}${v} = ${build(v, 0)};`];
      }
      case "Return":
        return [s.value === null ? `${ind}return;` : `${ind}return ${ex(s.value)};`];
      case "If": {
        const lines = [`${ind}if (${ex(s.cond)}) {`, ...stmts(s.body, ind + "  ")];
        if (s.orelse) lines.push(`${ind}} else {`, ...stmts(s.orelse, ind + "  "));
        lines.push(`${ind}}`);
        return lines;
      }
      case "ForIn": {
        const it = ex(s.iterable);
        return withScope(() => {
          const v = declare(s.var);
          return [`${ind}for (const ${v} of ${it}) {`, ...stmts(s.body, ind + "  "), `${ind}}`];
        });
      }
      case "ForWhile":
        return [`${ind}while (${ex(s.cond)}) {`, ...stmts(s.body, ind + "  "), `${ind}}`];
      case "ExprStmt":
        return [`${ind}${ex(s.expr)};`];
    }
  };

  const hasTry = (body: A.Stmt[]): boolean => {
    let found = false;
    const visit = (x: unknown) => {
      if (found || !x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(visit);
      if ((x as A.Expr).k === "Try") found = true;
      for (const v of Object.values(x)) visit(v);
    };
    visit(body);
    return found;
  };

  // ---- items
  const fnNames: string[] = [];
  for (const it of prog.items) {
    if (it.k !== "Fn" || info.userFns.get(it.name)?.node !== it) continue;
    fnNames.push(it.name);
    withScope(() => {
      const params = it.params.map(([n]) => declare(n));
      const lines: string[] = [`function f_${it.name}(${params.join(", ")}) {`];
      lines.push(`  $rt.enter(${JSON.stringify(it.name)}, ${it.line}, ${it.col});`);
      lines.push("  try {");
      if (it.requires) {
        const { line, col } = posOf(it.requires);
        lines.push(`    if ($rt.contracts && !(${ex(it.requires)})) $rt.trap("R001", ${JSON.stringify(`requires failed in fn ${it.name}`)}, ${line}, ${col});`);
      }
      let body = stmts(it.body, "      ");
      if (hasTry(it.body)) {
        body = ["      try {", ...body.map((l) => "  " + l), "      } catch ($e) { if ($e instanceof $rt.Early) return $e.value; throw $e; }"];
      }
      if (it.ensures) {
        lines.push("    const $result = (() => {", ...body, "    })();");
        withScope(() => {
          scopes[scopes.length - 1].vars.set("result", { js: "$result", mutable: false });
          const { line, col } = posOf(it.ensures!);
          lines.push(`    if ($rt.contracts && !(${ex(it.ensures!)})) $rt.trap("R002", ${JSON.stringify(`ensures failed in fn ${it.name}`)}, ${line}, ${col});`);
        });
        lines.push("    return $result;");
      } else {
        lines.push(...body.map((l) => l.slice(2)));
      }
      lines.push("  } finally {", "    $rt.leave();", "  }", "}");
      out.push(lines.join("\n"));
    });
  }

  const tests: string[] = [];
  for (const it of prog.items) {
    if (it.k !== "Test") continue;
    withScope(() => {
      const body = stmts(it.body, "    ");
      tests.push(`  [${JSON.stringify(JSON.parse(it.name))}, () => {\n    $rt.enter(${JSON.stringify(`test ${it.name}`)}, ${it.line}, ${it.col});\n    try {\n${body.map((l) => "  " + l).join("\n")}\n    } finally { $rt.leave(); }\n  }]`);
    });
  }

  // type table for to_string
  const table: Record<string, unknown> = {};
  for (const [name, r] of info.records) table[name] = { params: r.params.length, fields: r.fields.map(([n, t]) => [n, typeExprToTD(t, r.params)]) };
  for (const c of info.ctors.values()) {
    const entry = (table[c.type.name] ??= { params: c.type.params.length, variants: {} }) as { variants: Record<string, unknown> };
    entry.variants[c.name] = c.fields.map(([n, t]) => [n, typeExprToTD(t, c.type.params)]);
  }
  const main = info.userFns.get("main");
  const mainRet = main ? typeExprToTD(main.ret, main.tparams) : null;
  out.push(
    `return {\n  main: ${main ? "f_main" : "undefined"},\n  mainRet: ${JSON.stringify(mainRet)},\n  tests: [\n${tests.join(",\n")}\n  ],\n  types: ${JSON.stringify(table)},\n};`,
  );
  return out.join("\n\n") + "\n";
}

export interface CompileResult {
  check: CheckResult;
  /** Present only when check passed. */
  js?: string;
}

/** Check, then generate JavaScript. Code is generated only for programs with no errors. */
export function compileJs(src: string, path = "main.cn"): CompileResult {
  const a = analyze(src, path);
  if (!a.result.ok || !a.prog || !a.info) return { check: a.result };
  return { check: a.result, js: generate(a.prog, a.info) };
}

/** Wrap generated code as an ES2022 module that runs against @canon/runtime. */
export function asModule(js: string): string {
  return `export default function load($rt) {\n${js}}\n`;
}
