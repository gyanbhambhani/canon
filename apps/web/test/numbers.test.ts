/**
 * Numbers on the site come from scripts/stats.ts, never typed by hand. This test collects every
 * figure the generated data holds (as the pages would print it) and fails if a page source
 * contains one of them literally.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { siteData, type SiteData } from "../../../scripts/stats";

const web = join(__dirname, "..");
// content/docs joins this list once the docs restructure moves the research figures to /research
const SCANNED = ["app", "components", "lib"];
const SKIP = new Set(["lib/generated"]);

function walk(dir: string): string[] {
  if (SKIP.has(relative(web, dir))) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mdx)$/.test(p) ? [p] : [];
  });
}

/** distinctive printed forms: decimals, percentages with digits, thousands with commas, ranges */
function figures(site: SiteData): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    if (/\d/.test(s) && (/[.,%–x]/.test(s) || s.length >= 4) && !["1.00", "100%", site.display.version].includes(s)) out.add(s);
  };
  for (const v of Object.values(site.display)) if (typeof v === "string") add(v);
  for (const m of site.benchmark.byModel) {
    for (const arm of [m.canon, m.typescript]) {
      add(arm.distinct.toFixed(2));
      add(`${(100 * arm.firstPass).toFixed(1)}%`);
      add(arm.turns.toFixed(2));
    }
    add(m.ratio.toFixed(2));
    add(m.tokenMultiple.toFixed(1));
  }
  for (const r of site.likelihood.rows) for (const m of r.byModel) add(m.ratio.toPrecision(2));
  add(String(site.stats.referenceTokens));
  return [...out];
}

describe("no hand-typed numbers", async () => {
  const files = SCANNED.flatMap((d) => walk(join(web, d)));
  const figs = figures(await siteData());

  it("collects figures to look for", () => {
    expect(figs.length).toBeGreaterThan(15);
  });

  for (const f of files) {
    it(relative(web, f), () => {
      const text = readFileSync(f, "utf8").replace(/\b(d|viewBox|points)="[^"]*"/g, ""); // SVG geometry is not a figure
      const found = figs.filter((n) => new RegExp(`(?<![\\w.])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`).test(text));
      expect(found, `hard-coded figures in ${relative(web, f)}`).toEqual([]);
    });
  }
});
