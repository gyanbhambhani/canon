/** M7 acceptance: release files. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

describe("release readiness", () => {
  it("every package is version 0.4.0", () => {
    for (const p of ["package.json", "packages/compiler/package.json", "packages/runtime/package.json", "packages/cli/package.json", "apps/web/package.json"]) {
      expect(JSON.parse(read(p)).version, p).toBe("0.4.0");
    }
  });

  it("LICENSE is MIT, and CONTRIBUTING.md exists", () => {
    expect(read("LICENSE")).toMatch(/^MIT License/);
    expect(existsSync(join(root, "CONTRIBUTING.md"))).toBe(true);
  });

  it("README has the pitch, a code sample, a quickstart and links", () => {
    const r = read("README.md");
    expect(r).toMatch(/programming language for AI agents/);
    expect(r).toMatch(/```canon\n/);
    expect(r).toMatch(/## Quickstart/);
    expect(r).toMatch(/node packages\/cli\/dist\/index\.js run examples\/hello\.cn/);
    for (const link of ["SPEC.md", "DEPLOY.md", "CONTRIBUTING.md", "LICENSE"]) expect(r).toContain(`](${link})`);
  });

  it("DEPLOY.md lists the owner's steps in order", () => {
    const d = read("DEPLOY.md");
    const order = ["Create the GitHub repository", "Push", "Set NEXT_PUBLIC_GITHUB_URL", "Import apps/web into Vercel", "Publish canon-lang to npm"];
    const at = order.map((h) => d.indexOf(h));
    for (const [i, x] of at.entries()) expect(x, order[i]).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
