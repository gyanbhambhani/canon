/**
 * Every number and generated text the site shows, computed from the repository at build time.
 * Prints a summary; with --write it also writes apps/web/lib/generated/site.json and refreshes
 * the generated blocks in README.md. Pages never type a number by hand (apps/web/test/numbers.test.ts).
 *
 *  - stats: sizes of the reference, the test corpus and the standard library
 *  - benchmark: research/benchmark/results/runs.jsonl under PREREGISTRATION.md
 *  - likelihood: research/likelihood/results, the rows where models prefer another spelling
 *  - terminal: the hero transcript, produced by running the real CLI on examples/mistakes/missing-effect.cn
 *  - snippets and examples: source shown on the landing page and loaded by the playground
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRELUDE, readSource } from "@canon/compiler";
import { loadBenchmark } from "./site-data/benchmark.js";
import { loadLikelihood } from "./site-data/likelihood.js";
import { buildDisplay } from "./site-data/display.js";
import { heroTranscript } from "./site-data/terminal.js";
import { renderReadme } from "./site-data/readme.js";

export const root = join(fileURLToPath(import.meta.url), "..", "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");
const count = (dir: string, ext = ".cn") =>
  readdirSync(join(root, dir)).filter((f) => f.endsWith(ext) && !f.endsWith(".fmt.cn")).length;

export async function siteData() {
  // the agent reference is the Agent reference page without its frontmatter (also /llms.txt)
  const reference = read("apps", "web", "content", "docs", "for-agents.mdx").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  const fuzzTotal = Number(/const TOTAL = ([\d_]+)/.exec(read("tests", "fuzz.test.ts"))![1].replace(/_/g, ""));
  const version: string = JSON.parse(read("packages", "cli", "package.json")).version;

  const stats = {
    version,
    referenceTokens: Math.round(reference.length / 3.5),
    fuzzedVariants: fuzzTotal,
    conformanceTests: count("tests/conformance"),
    stdlibFunctions: [...PRELUDE.matchAll(/^fn \w+/gm)].length,
    typeTests: count("tests/types/pass") + count("tests/types/fail"),
    runPrograms: count("tests/run"),
  };

  // the current language (v0.2) leads; v0 is the earlier run it is compared with
  const benchmark = loadBenchmark(root, "runs-v0.2.jsonl", "REPORT-v0.2.md");
  const benchmarkV0 = loadBenchmark(root, "runs.jsonl", "REPORT.md");
  const likelihood = loadLikelihood(root);

  // the landing page's Syntax panel: examples/orders.cn up to its sample data
  const orders = readSource(read("examples", "orders.cn"));
  const ordersSnippet = orders.slice(0, orders.indexOf("\nfn sample")).trimEnd() + "\n";

  // the playground's Examples menu (labels in apps/web/lib/examples.ts) and its Break it mistakes
  const examples = [
    { id: "missing-effect", file: "mistakes/missing-effect.cn" },
    { id: "orders", file: "orders.cn" },
    { id: "result-try", file: "result_try.cn" },
    { id: "incomplete-match", file: "mistakes/incomplete-match.cn" },
  ].map((e) => ({ ...e, source: readSource(read("examples", e.file)) }));
  const mistakes = readdirSync(join(root, "examples", "mistakes"))
    .filter((f) => f.endsWith(".cn"))
    .sort()
    .map((f) => ({ id: f.replace(/\.cn$/, ""), source: readSource(read("examples", "mistakes", f)) }));

  const terminal = await heroTranscript(root);
  const display = buildDisplay(stats, benchmark, benchmarkV0, lastStudyDate());
  return { stats, display, benchmark, benchmarkV0, likelihood, terminal, ordersSnippet, examples, mistakes };
}

export type SiteData = Awaited<ReturnType<typeof siteData>>;

/**
 * The date of the latest benchmark study: the commit date of its raw runs. Builds without git
 * history (some CI checkouts) fall back to the newest dated entry in DECISIONS.md.
 */
function lastStudyDate(): string {
  let iso = "";
  try {
    iso = execFileSync("git", ["log", "-1", "--format=%cs", "--", "research/benchmark/results/runs-v0.2.jsonl"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    iso = "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = /^## (\d{4}-\d{2}-\d{2})/m.exec(read("DECISIONS.md"))?.[1] ?? "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const data = await siteData();
  for (const [k, v] of Object.entries(data.stats)) console.log(`${k.padEnd(18)} ${v}`);
  for (const [k, v] of Object.entries(data.display)) console.log(`${k.padEnd(18)} ${v}`);
  for (const v of data.benchmark.verdicts) console.log(`${v.id} ${v.verdict}`);

  if (process.argv.includes("--write")) {
    const out = join(root, "apps", "web", "lib", "generated");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "site.json"), JSON.stringify(data, null, 2) + "\n");
    console.log("wrote apps/web/lib/generated/site.json");
    const readme = read("README.md");
    const next = renderReadme(readme, data);
    if (next !== readme) {
      writeFileSync(join(root, "README.md"), next);
      console.log("updated the generated blocks in README.md");
    }
  }
}
