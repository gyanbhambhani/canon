import site from "./generated/site.json";

/**
 * Build-time data written by scripts/stats.ts: every number, the hero transcript, the snippets
 * and the playground examples. Pages read from here and never type a number by hand.
 */
export type { SiteData } from "../../../scripts/stats";
export type { TermLine } from "../../../scripts/site-data/terminal";
import type { SiteData } from "../../../scripts/stats";

export const siteData = site as unknown as SiteData;
export const fmtNumber = (n: number) => n.toLocaleString("en-US");
