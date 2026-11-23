/**
 * v0.5 M3 and M4: the worked example's generated files must equal the golden files in
 * tests/v05/golden/todos/expected (the spec's text, plus each file's hash line).
 *
 * Committed first as expected failures (`it.fails`), as the owner's build prompt asks; each
 * becomes a plain `it` when its generator lands. If a golden file and the generator disagree,
 * fix the generator; change a golden file only with a reason in DECISIONS.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as compiler from "@canon/compiler";

const dir = join(__dirname, "golden", "todos");
const TODOS = readFileSync(join(dir, "canon", "todos.cn"), "utf8");
const expected = (p: string) => readFileSync(join(dir, "expected", p), "utf8");

type Gen = (p: compiler.ProjectResult) => { path: string; text: string }[];

function generated(name: "generateFastapi" | "generateTsClient", file: string): string {
  const project = compiler.checkProject([{ name: "todos", path: "canon/todos.cn", src: TODOS }]);
  expect(project.ok).toBe(true);
  const gen = (compiler as unknown as Record<string, Gen | undefined>)[name];
  if (!gen) throw new Error(`${name} is not implemented yet`);
  const f = gen(project).find((x) => x.path === file);
  if (!f) throw new Error(`${name} did not generate ${file}`);
  return f.text;
}

describe("golden: the worked example's Python (M3)", () => {
  for (const f of ["models.py", "logic.py", "api.py"]) {
    it(f, () => {
      expect(generated("generateFastapi", f)).toBe(expected(`backend/canon_generated/${f}`));
    });
  }
});

describe("golden files", () => {
  it("carry an intact hash", () => {
    for (const f of ["backend/canon_generated/models.py", "backend/canon_generated/logic.py", "backend/canon_generated/api.py",
      "frontend/src/canon/types.ts", "frontend/src/canon/validate.ts", "frontend/src/canon/client.ts"]) {
      expect(compiler.inspectGenerated(expected(f)), f).toEqual({ generated: true, intact: true });
    }
    expect(compiler.inspectGenerated(expected("backend/canon_generated/api.py").replace("todos", "todo"))).toEqual({ generated: true, intact: false });
  });
});
