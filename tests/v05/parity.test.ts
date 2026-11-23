/**
 * v0.5 M5: the semantic parity suite. 2,000 random expressions from the portable subset (the
 * language of an api fn's requires), each evaluated three ways on three random inputs:
 *   - the Canon JavaScript runtime (the api fn called with contracts on; R001 means false),
 *   - the generated Python (the route's require; ValidationFailed means false),
 *   - the generated TypeScript (the validator; a ValidationError means false).
 * All three must agree on every evaluation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { checkProject, compileJs, fmt, generateTsClient, walkExprs, type ProjectResult } from "@canon/compiler";
import { MemoryHost, NONE, Runtime, load, some, testHost } from "@canon/runtime";
import { buildBackend, py } from "./helpers/py";

const COUNT = 2000;
const INPUTS = 3;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Strings that differ between languages: unicode whitespace, NEL, astral characters, email-ish. */
const STRINGS = ["", " ", "a", "Ab", "  x ", " y ", " ", "﻿z", "\u0085w\u0085", "​", "\t", "😀", "é", "ada@example.com",
  "a@b.c", "a b@c.d", "@x.y", "q@w", "Z", "zz", "　k", "\u001c", "a "];
const FLOATS = ["0.5", "1.5", "-2.25", "3.0", "0.1", "100.75"];

type Ty = "Int" | "Float" | "String" | "Bool";

/** A Canon string literal: the escapes are \" \\ \n \t; everything else is written as is. */
const canonLit = (v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';

function makeGen(r: () => number) {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const lit = (t: Ty): string => {
    switch (t) {
      case "Int":
        return String(Math.floor(r() * 41) - 20);
      case "Float":
        return pick(FLOATS);
      case "String":
        return canonLit(pick(STRINGS));
      case "Bool":
        return pick(["true", "false"]);
    }
  };
  const field: Record<Ty, string[]> = {
    Int: ["input.x", "input.y", "len(input.xs)", "len(input.words)"],
    Float: ["input.f", "input.g"],
    String: ["input.s", "input.t"],
    Bool: ["input.b", "is_some(input.o)"],
  };
  const gen = (t: Ty, depth: number): string => {
    if (depth <= 0 || r() < 0.25) return r() < 0.6 ? pick(field[t]) : lit(t);
    const d = depth - 1;
    switch (t) {
      case "Int":
        return pick([
          () => `(${gen("Int", d)} + ${gen("Int", d)})`,
          () => `(${gen("Int", d)} - ${gen("Int", d)})`,
          () => `(${gen("Int", d)} * ${gen("Int", d)})`,
          () => `(${gen("Int", d)} / ${pick(["3", "-2", "7", "1"])})`,
          () => `(${gen("Int", d)} % ${pick(["3", "-2", "5"])})`,
          () => `(-${gen("Int", d)})`,
          () => `str_len(${gen("String", d)})`,
        ])();
      case "Float":
        return pick([
          () => `(${gen("Float", d)} + ${gen("Float", d)})`,
          () => `(${gen("Float", d)} - ${gen("Float", d)})`,
          () => `(${gen("Float", d)} * ${gen("Float", d)})`,
          () => `(${gen("Float", d)} / ${pick(["2.0", "-0.5", "3.0"])})`,
          () => `(${gen("Float", d)} % ${pick(["2.0", "-1.5"])})`,
        ])();
      case "String":
        return pick([() => `trim(${gen("String", d)})`, () => `(${gen("String", d)} + ${gen("String", d)})`])();
      case "Bool": {
        const cmp = pick(["==", "!=", "<", "<=", ">", ">="]);
        const ct = pick<Ty>(["Int", "Int", "Float", "String"]);
        return pick([
          () => `(${gen(ct, d)} ${cmp} ${gen(ct, d)})`,
          () => `(${gen("Bool", d)} && ${gen("Bool", d)})`,
          () => `(${gen("Bool", d)} || ${gen("Bool", d)})`,
          () => `(!${gen("Bool", d)})`,
          () => `is_email(${gen("String", d)})`,
          () => `contains(input.xs, ${gen("Int", d)})`,
          () => `contains([${lit("String")}, ${lit("String")}], ${gen("String", d)})`,
          () => `(${gen("Bool", d)} == ${gen("Bool", d)})`,
        ])();
      }
    }
  };
  const input = () => ({
    x: Math.floor(r() * 61) - 30,
    y: Math.floor(r() * 61) - 30,
    f: Number(pick(FLOATS)) * (r() < 0.3 ? -1 : 1),
    g: Number(pick(FLOATS)),
    s: pick(STRINGS) + (r() < 0.4 ? pick(STRINGS) : ""),
    t: pick(STRINGS),
    b: r() < 0.5,
    o: r() < 0.4 ? null : Math.floor(r() * 10),
    xs: Array.from({ length: Math.floor(r() * 4) }, () => Math.floor(r() * 21) - 10),
    words: Array.from({ length: Math.floor(r() * 3) }, () => pick(STRINGS)),
  });
  return { gen, input };
}

const HEAD = `type In {
  x: Int,
  y: Int,
  f: Float,
  g: Float,
  s: String,
  t: String,
  b: Bool,
  o: Option[Int],
  xs: List[Int],
  words: List[String],
}
`;

let project: ProjectResult;
const exprs: string[] = [];
const inputs: ReturnType<ReturnType<typeof makeGen>["input"]>[][] = [];
let dir = "";

beforeAll(() => {
  const r = rng(2026);
  const { gen, input } = makeGen(r);
  // each expression must check, fit on a line, and mention the input
  const fns: string[] = [];
  while (exprs.length < COUNT) {
    const e = gen("Bool", 1 + Math.floor(r() * 3));
    if (!e.includes("input.")) continue;
    const i = exprs.length;
    const fn = `api fn p${i}(input: In) -> Int\n  route: POST "/p${i}"\n  requires: ${e}\n{\n  return 0\n}\n`;
    let text: string;
    try {
      text = fmt(HEAD + "\n" + fn);
    } catch {
      continue;
    }
    if (text.split("\n").some((l) => l.length > 100)) continue;
    exprs.push(e);
    fns.push(text.slice(fmt(HEAD).length + 1));
    inputs.push(Array.from({ length: INPUTS }, input));
  }
  const src = fmt(HEAD + "\n" + fns.join("\n"));
  project = checkProject([{ name: "parity", path: "canon/parity.cn", src }]);
  if (!project.ok) {
    const bad = project.modules[0].result.diagnostics.slice(0, 5);
    throw new Error("the parity program does not check: " + JSON.stringify(bad));
  }
  dir = buildBackend(project);
}, 300_000);

describe("semantic parity: JavaScript runtime, generated Python, generated TypeScript", () => {
  it(`${COUNT} random portable expressions × ${INPUTS} inputs agree in all three`, async () => {
    // 1. the Canon JavaScript runtime
    const src = project.modules[0].src;
    const c = compileJs(src, "parity.cn");
    expect(c.check.ok).toBe(true);
    const rt = new Runtime(testHost(new MemoryHost()), { contracts: true });
    const mod = load(c.js!, rt);
    const toCanon = (v: ReturnType<ReturnType<typeof makeGen>["input"]>) => ({ $t: "In", ...v, o: v.o === null ? NONE : some(v.o) });
    const jsSays = exprs.map((_, i) => inputs[i].map((v) => {
      try {
        mod.fns[`p${i}`](toCanon(v));
        return true;
      } catch (e) {
        rt.stack.length = 0;
        if ((e as { code?: string }).code === "R001") return false;
        return `trap ${(e as { code?: string }).code ?? String(e)}`;
      }
    }));

    // 2. the generated Python: each route's require
    writeFileSync(join(dir, "parity.json"), JSON.stringify(inputs));
    const pySays = py(dir, `
import json
from canon_generated import api
from canon_generated.models import In
from canon_generated.runtime import ValidationFailed
out = []
for i, cases in enumerate(json.load(open("parity.json"))):
    route = getattr(api, f"p{i}")
    row = []
    for c in cases:
        try:
            route(In(**c))
            row.append(True)
        except ValidationFailed:
            row.append(False)
        except Exception as e:
            row.append(f"trap {type(e).__name__}")
    out.append(row)
print(json.dumps(out))
`) as (boolean | string)[][];

    // 3. the generated TypeScript validators
    const out = join(dir, "ts");
    mkdirSync(out, { recursive: true });
    for (const f of generateTsClient(project)) {
      const js = ts.transpileModule(f.text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
        .outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
      writeFileSync(join(out, f.path.replace(/\.ts$/, ".mjs")), js);
    }
    const validate = await import(pathToFileURL(join(out, "validate.mjs")).href);
    const tsSays = exprs.map((_, i) => inputs[i].map((v) => {
      try {
        return validate[`validateP${i}`](v) === null;
      } catch (e) {
        return `throws ${String(e)}`;
      }
    }));

    const disagree: unknown[] = [];
    exprs.forEach((e, i) => inputs[i].forEach((v, k) => {
      if (jsSays[i][k] !== pySays[i][k] || jsSays[i][k] !== tsSays[i][k]) {
        disagree.push({ expr: e, input: v, js: jsSays[i][k], py: pySays[i][k], ts: tsSays[i][k] });
      }
    }));
    expect(disagree.slice(0, 5), `${disagree.length} disagreements`).toEqual([]);
    // the suite exercises both outcomes, and nothing traps
    const all = jsSays.flat();
    expect(all.filter((x) => x === true).length).toBeGreaterThan(COUNT / 4);
    expect(all.filter((x) => x === false).length).toBeGreaterThan(COUNT / 4);
    expect(all.filter((x) => typeof x === "string")).toEqual([]);
  }, 600_000);

  it("the generated expressions cover every portable built-in and operator", () => {
    const text = exprs.join("\n");
    for (const needle of ["str_len(", "trim(", "contains(input.xs", "contains([", "is_email(", "is_some(", "len(input.xs)", " / ", " % ", " && ", " || ", "!", " < ", " >= ", " + ", " * ", " - "]) {
      expect(text, needle).toContain(needle);
    }
    // every expression mentions the input, so every validator takes it
    for (const fn of project.modules[0].analysis.prog!.items) {
      if (fn.k === "Fn" && fn.requires) expect([...walkExprs(fn.requires)].some((x) => x.k === "Name" && x.path[0] === "input")).toBe(true);
    }
  });
});
