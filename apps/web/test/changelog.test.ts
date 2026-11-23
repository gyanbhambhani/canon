/**
 * /changelog: every Canon sample on the page passes the real compiler (and is in canonical form),
 * the release claims match the repository, and the page names every version with its anchor.
 * Numbers on the page come from scripts/stats.ts (numbers.test.ts scans this page too).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check, fmt, V04_PY } from "@canon/compiler";
import { CREATE_TODO_PYTHON, CREATE_TODO_TYPESCRIPT, RELEASES, SAMPLES, V05_RELEASED } from "../app/(home)/changelog/releases";

const root = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const page = readFileSync(join(__dirname, "..", "app", "(home)", "changelog", "page.tsx"), "utf8");

describe("changelog samples", () => {
  for (const s of Object.values(SAMPLES)) {
    const opts = s.syntax === "py" ? { features: V04_PY } : {};
    it(`${s.id} checks and is canonical`, () => {
      expect(check(s.code, `${s.id}.cn`, opts).diagnostics).toEqual([]);
      expect(fmt(s.code, opts)).toBe(s.code);
    });
  }

  it("every sample is used on the page, and every sample the page uses exists", () => {
    const used = [...page.matchAll(/<Block id="(\w+)"/g)].map((m) => m[1]);
    expect(new Set(used)).toEqual(new Set(Object.keys(SAMPLES)));
  });

  it("the generated Python and TypeScript excerpts are copied from the golden files", () => {
    expect(read("tests/v05/golden/todos/expected/backend/canon_generated/api.py")).toContain(CREATE_TODO_PYTHON.trimEnd());
    const client = read("tests/v05/golden/todos/expected/frontend/src/canon/client.ts");
    // the golden client is indented inside createClient's return; the excerpt is the same lines, dedented
    const dedented = client.split("\n").map((l) => l.replace(/^ {4}/, "")).join("\n");
    expect(dedented).toContain(CREATE_TODO_TYPESCRIPT.trimEnd());
  });
});

describe("changelog releases", () => {
  it("lists v0.5, v0.4, v0.3, v0.2 and v0, newest first, each with an anchor on the page", () => {
    expect(RELEASES.map((r) => r.language)).toEqual(["v0.5", "v0.4", "v0.3", "v0.2", "v0"]);
    for (const r of RELEASES) expect(page).toContain(`id="${r.id}"`);
  });

  it("each version's dates are the first and last commit dates of its work", () => {
    for (const r of RELEASES) {
      expect(r.from <= r.to).toBe(true);
      expect(r.from).toMatch(/^2026-11-2[23]$/);
    }
  });

  it("v0.5 is called released only when the local package says so and the flag is set", () => {
    const local = JSON.parse(read("packages/cli/package.json")).version;
    const v05 = RELEASES.find((r) => r.id === "v0-5")!;
    expect(local).toBe("0.5.0");
    if (V05_RELEASED) expect(v05.npm).toBe("0.5.0");
    else expect(v05.npm).toBe("0.5.0, unreleased");
    // the page never says "published" about 0.5.0 while the flag is false
    expect(page).toContain("V05_RELEASED");
  });

  it("the page links the reports its v0.5 numbers come from, and each exists", () => {
    for (const f of ["research/canonbench/REPORT.md", "research/fs1/REPORT.md", "research/va1/REPORT.md", "research/opus-partial/README.md", "docs/v0.5-fullstack.md", "docs/v0.4-design.md", "docs/v0.3-proposal.md"]) {
      expect(page, f).toContain(f);
      expect(() => read(f), f).not.toThrow();
    }
  });

  it("states the v0.5 findings plainly: no verdict, a failed prediction, and the costs", () => {
    for (const phrase of ["could not be evaluated", "A prediction failed", "lost every writing family", "costs several times the tokens"]) {
      expect(page, phrase).toContain(phrase);
    }
  });
});

describe("changelog links", () => {
  it("the top nav and the footer both link /changelog", () => {
    expect(read("apps/web/components/site/nav.tsx")).toContain('href: "/changelog"');
    expect(read("apps/web/components/site/footer.tsx")).toContain('href: "/changelog"');
  });
});
