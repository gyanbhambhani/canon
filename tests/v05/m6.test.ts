/**
 * v0.5 M6: the example apps. Their committed generated code is exactly what canon build makes
 * (CI diffs it), they check clean, their frontends type-check against the generated client, and
 * their backends pass ruff and mypy --strict. The end-to-end UI tests are in e2e/examples
 * (pnpm e2e:examples).
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "./helpers/py";

const root = join(__dirname, "..", "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const canon = (args: string[], cwd: string) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "__pycache__" || e.name.startsWith(".")) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}

for (const ex of ["todos", "shop"]) {
  const dir = join(root, "examples", ex);
  describe(`examples/${ex}`, () => {
    it("checks clean and has a manifest", () => {
      const c = canon(["check"], dir);
      expect(c.status, c.stdout + c.stderr).toBe(0);
      expect(canon(["manifest"], dir).stdout).toMatch(/^(GET|POST)/);
    });

    it("its committed generated code is exactly what canon build makes", () => {
      const d = mkdtempSync(join(tmpdir(), `canon-ex-${ex}-`));
      cpSync(join(dir, "canon.toml"), join(d, "canon.toml"));
      cpSync(join(dir, "canon"), join(d, "canon"), { recursive: true });
      const b = canon(["build"], d);
      expect(b.status, b.stderr).toBe(0);
      for (const out of ["backend/canon_generated", "frontend/src/canon"]) {
        const fresh = files(join(d, out)).map((f) => relative(d, f)).sort();
        const committed = files(join(dir, out)).map((f) => relative(dir, f)).sort();
        expect(committed).toEqual(fresh);
        for (const f of fresh) expect(readFileSync(join(dir, f), "utf8"), f).toBe(readFileSync(join(d, f), "utf8"));
      }
    });

    it("its frontend type-checks against the generated client", () => {
      const r = spawnSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "."], { cwd: join(dir, "frontend"), encoding: "utf8" });
      expect(r.status, r.stdout + r.stderr).toBe(0);
    });

    it("its backend passes ruff and mypy --strict, main.py included", () => {
      const back = join(dir, "backend");
      const fmt = run("ruff", ["format", "--isolated", "--check", "."], back);
      expect(fmt.code, fmt.out + fmt.err).toBe(0);
      const lint = run("ruff", ["check", "--isolated", "."], back);
      expect(lint.code, lint.out + lint.err).toBe(0);
      const types = run("mypy", ["--strict", "canon_generated", "main.py"], back);
      expect(types.code, types.out + types.err).toBe(0);
    }, 120_000);
  });
}
