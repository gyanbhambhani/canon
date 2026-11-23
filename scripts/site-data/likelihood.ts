/**
 * The likelihood study rows where models prefer a spelling other than Canon's v0 one, computed
 * from research/likelihood/results/*.json with the rules in research/likelihood/report.py.
 * Whether today's Canon adopted the preferred spelling is decided by the formatter, not by hand:
 * the v0 spelling no longer formats to itself, and it formats to the same text as the alternative.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fmt } from "@canon/compiler";

interface Row {
  context: number;
  variant: string;
  logprob: number;
  text: string;
}
interface Construct {
  id: string;
  question: string;
  canon: string;
  rows: Row[];
}

export interface LikelihoodRow {
  id: string;
  question: string;
  canonSpelling: string;
  preferred: string;
  /** per model: e^delta (Canon's v0 spelling over the preferred one) and how many contexts agree */
  byModel: { model: string; ratio: number; agree: number; contexts: number }[];
  /** true when today's formatter writes the preferred spelling */
  adopted: boolean;
}

export interface Likelihood {
  models: string[];
  rows: LikelihoodRow[];
}

function tryFmt(src: string): string | null {
  try {
    return fmt(src);
  } catch {
    return null;
  }
}

function summarize(c: Construct) {
  const variants = [...new Set(c.rows.map((r) => r.variant))].sort();
  const contexts = [...new Set(c.rows.map((r) => r.context))].sort();
  const lp = new Map(c.rows.map((r) => [`${r.context}|${r.variant}`, r.logprob]));
  const mean = Object.fromEntries(variants.map((v) => [v, contexts.reduce((a, ci) => a + lp.get(`${ci}|${v}`)!, 0) / contexts.length]));
  const best = (vs: string[], f: (v: string) => number) => vs.reduce((a, b) => (f(b) > f(a) ? b : a));
  const winner = best(variants, (v) => mean[v]);
  const bestAlt = best(variants.filter((v) => v !== c.canon), (v) => mean[v]);
  const delta = mean[c.canon] - mean[bestAlt];
  const agree = contexts.filter((ci) => best(variants, (v) => lp.get(`${ci}|${v}`)!) === winner).length;
  return { winner, bestAlt, delta, agree, contexts: contexts.length };
}

export function loadLikelihood(root: string): Likelihood {
  const dir = join(root, "research", "likelihood", "results");
  const results: { model: string; constructs: Construct[] }[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const models = results.map((r) => r.model);
  const rows: LikelihoodRow[] = [];
  for (const c of results[0].constructs) {
    const per = results.map((r) => ({ model: r.model, c: r.constructs.find((x) => x.id === c.id)! }));
    const sums = per.map((p) => ({ model: p.model, ...summarize(p.c) }));
    // a row is listed when every model prefers the same non-Canon spelling
    const preferred = sums[0].winner;
    if (preferred === c.canon || !sums.every((s) => s.winner === preferred)) continue;
    const text = (v: string) => c.rows.find((r) => r.context === 0 && r.variant === v)!.text;
    const v0 = text(c.canon);
    const f0 = tryFmt(v0);
    const fAlt = tryFmt(text(preferred));
    rows.push({
      id: c.id,
      question: c.question,
      canonSpelling: c.canon,
      preferred,
      byModel: sums.map((s) => ({ model: s.model, ratio: Math.exp(s.delta), agree: s.agree, contexts: s.contexts })),
      adopted: f0 !== null && f0 !== v0 && f0 === fAlt,
    });
  }
  return { models, rows };
}
