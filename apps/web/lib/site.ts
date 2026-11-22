import site from "./generated/site.json";

/** Build-time data from scripts/stats.ts (numbers, hero variants, examples). */
export interface SiteData {
  stats: {
    referenceTokens: number;
    fuzzedVariants: number;
    conformanceTests: number;
    stdlibFunctions: number;
    typeTests: number;
    runPrograms: number;
  };
  orders: { canonical: string; variants: string[] };
  examples: { name: string; source: string }[];
}

export const siteData = site as SiteData;

export const fmtNumber = (n: number) => n.toLocaleString("en-US");
