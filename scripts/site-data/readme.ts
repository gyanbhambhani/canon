/**
 * README.md has generated blocks between <!-- generated:NAME --> and <!-- /generated:NAME -->.
 * `pnpm stats --write` (and the web build) refreshes them; tests/readme.test.ts fails when stale.
 */
import type { SiteData } from "../stats.js";

export function readmeBlocks(d: SiteData): Record<string, string> {
  const x = d.display;
  return {
    terminal: ["```text", ...d.terminal.lines.map((l) => l.text), "```"].join("\n"),
    benchmark: [
      `${x.runs} runs across ${x.tasks} tasks with ${x.modelCount} frontier models (${d.benchmark.models.join(", ")}). Success criteria were committed before any data was collected.`,
      "",
      "| Metric | Canon | TypeScript |",
      "| --- | --- | --- |",
      `| Correct | ${x.canonCorrect} | ${x.tsCorrect} |`,
      `| Valid on the first try | ${x.canonFirstPassRange} | ${x.tsFirstPass} |`,
      `| Tries to working code | ${x.turnsRange} | ${x.tsTurns} |`,
      `| Distinct programs per task (lower is better; not improved yet) | ${x.canonDistinctRange} | ${x.tsDistinctRange} |`,
    ].join("\n"),
  };
}

export function renderReadme(readme: string, d: SiteData): string {
  let out = readme;
  for (const [name, body] of Object.entries(readmeBlocks(d))) {
    const re = new RegExp(`(<!-- generated:${name} -->\\n)[\\s\\S]*?(<!-- /generated:${name} -->)`);
    out = out.replace(re, (_m, a: string, b: string) => `${a}${body}\n${b}`);
  }
  return out;
}
