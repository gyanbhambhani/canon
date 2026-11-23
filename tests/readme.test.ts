/** README.md's generated blocks (hero transcript, benchmark table) match scripts/stats.ts. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteData } from "../scripts/stats";
import { renderReadme } from "../scripts/site-data/readme";

describe("README", () => {
  it("the generated blocks are present and current (run `pnpm --filter web stats` to refresh)", async () => {
    const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");
    for (const name of ["terminal", "benchmark"]) {
      expect(readme).toContain(`<!-- generated:${name} -->`);
      expect(readme).toContain(`<!-- /generated:${name} -->`);
    }
    expect(renderReadme(readme, await siteData())).toBe(readme);
  });
});
