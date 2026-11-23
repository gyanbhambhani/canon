/** M6: the GitHub link comes from NEXT_PUBLIC_GITHUB_URL and disappears when it is unset. */
import { afterEach, describe, expect, it, vi } from "vitest";

describe("GitHub link", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads NEXT_PUBLIC_GITHUB_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_GITHUB_URL", "https://github.com/example/canon");
    const { githubUrl } = await import("../lib/shared");
    expect(githubUrl).toBe("https://github.com/example/canon");
  });

  it("is undefined (hidden) when the variable is unset or empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_GITHUB_URL", "");
    const { githubUrl } = await import("../lib/shared");
    expect(githubUrl).toBeUndefined();
  });

  it("the landing page and nav render GitHub links only when it is set", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(new URL("../app/(home)/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/\{githubUrl \? <Button href=\{githubUrl\}>View on GitHub<\/Button> : null\}/);
    expect(page).not.toMatch(/github\.com/);
    const nav = readFileSync(new URL("../components/site/nav.tsx", import.meta.url), "utf8");
    expect(nav).toMatch(/\{githubUrl \? \(/);
    expect(nav).not.toMatch(/github\.com/);
    const layout = readFileSync(new URL("../lib/layout.shared.tsx", import.meta.url), "utf8");
    expect(layout).toMatch(/\.\.\.\(githubUrl \? \{ githubUrl \} : \{\}\)/);
  });
});
