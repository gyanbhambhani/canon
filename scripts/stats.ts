/**
 * The numbers the landing page shows, computed from the repository at build time.
 * Prints them, and with --write also writes apps/web/lib/generated/site.json, which holds
 * the numbers, five scrambled variants of examples/orders.cn for the hero panel, and every
 * file in examples/ for the playground's Examples menu.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fmt, fuzzVariant, PRELUDE, readSource, rng } from "@canon/compiler";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");
const count = (dir: string, ext = ".cn") =>
  readdirSync(join(root, dir)).filter((f) => f.endsWith(ext) && !f.endsWith(".fmt.cn")).length;

// the agent reference is the For agents page without its frontmatter
const reference = read("apps", "web", "content", "docs", "for-agents.mdx").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
const fuzzTotal = Number(/const TOTAL = ([\d_]+)/.exec(read("tests", "fuzz.test.ts"))![1].replace(/_/g, ""));

const stats = {
  referenceTokens: Math.round(reference.length / 3.5),
  fuzzedVariants: fuzzTotal,
  conformanceTests: count("tests/conformance"),
  stdlibFunctions: [...PRELUDE.matchAll(/^fn \w+/gm)].length,
  typeTests: count("tests/types/pass") + count("tests/types/fail"),
  runPrograms: count("tests/run"),
};

const canonical = readSource(read("examples", "orders.cn"));
const r = rng(2026);
const variants: string[] = [];
// mostly single spaces with the odd line break: scrambled but still readable on a slide
const display = [" ", " ", " ", " ", "  ", "\n", "\n  "];
while (variants.length < 5) {
  const v = fuzzVariant(canonical, r, display);
  if (v === canonical || variants.includes(v)) continue;
  if (fmt(v) !== canonical) throw new Error("a displayed variant does not collapse to the canonical text");
  variants.push(v);
}

const examples = readdirSync(join(root, "examples"))
  .filter((f) => f.endsWith(".cn"))
  .sort((a, b) => (a === "hello.cn" ? -1 : b === "hello.cn" ? 1 : a.localeCompare(b)))
  .map((f) => ({ name: f, source: readSource(read("examples", f)) }));

for (const [k, v] of Object.entries(stats)) console.log(`${k.padEnd(18)} ${v}`);

if (process.argv.includes("--write")) {
  const out = join(root, "apps", "web", "lib", "generated");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "site.json"), JSON.stringify({ stats, orders: { canonical, variants }, examples }, null, 2) + "\n");
  console.log("wrote apps/web/lib/generated/site.json");
}
