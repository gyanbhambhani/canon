/**
 * M5 acceptance: the docs.
 *  - every page in the spec's page tree exists with real content
 *  - every ```canon block passes `check`, or fails with the code named by its `# expect: CODE` line
 *  - /llms.txt (the For agents page) and /llms-py.txt (its Canon-Py twin) stay under 4,000 tokens
 *    (characters / 3.5); a ```canon block marked syntax=py is checked as Canon-Py
 *
 * Blocks are checked one by one. A fence with `name=foo` can be prepended to a later block on
 * the same page whose fence says `include=foo`, so a page can build one program across blocks.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { check, V04_PY } from "@canon/compiler";
import { agentReference, stripFrontmatter } from "../lib/agent-reference";

const docs = join(__dirname, "..", "content", "docs");

const TREE = [
  "index", "quickstart", "agents",
  "guide/files-and-syntax", "guide/types-and-declarations", "guide/functions-effects-contracts",
  "guide/statements-and-mutation", "guide/expressions-and-precedence", "guide/pattern-matching",
  "guide/errors-result-try", "guide/pipelines", "guide/holes", "guide/canon-py",
  "canonical-form", "diagnostics", "stdlib", "cli", "for-agents", "for-agents-py", "design-notes", "roadmap",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".mdx") ? [p] : [];
  });
}

export interface Block {
  file: string;
  line: number;
  meta: string;
  code: string;
}

export function canonBlocks(file: string): Block[] {
  const text = readFileSync(file, "utf8");
  const out: Block[] = [];
  const re = /^```canon([^\n]*)\n([\s\S]*?)^```$/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ file, line: text.slice(0, m.index).split("\n").length, meta: m[1].trim(), code: m[2] });
  }
  return out;
}

const attr = (meta: string, key: string) => new RegExp(`(?:^|\\s)${key}=([\\w-]+)`).exec(meta)?.[1];

describe("docs pages", () => {
  for (const slug of TREE) {
    it(`${slug} exists with real content`, () => {
      const body = stripFrontmatter(readFileSync(join(docs, `${slug}.mdx`), "utf8"));
      expect(body).not.toMatch(/\bTODO\b/);
      expect(body.trim().length).toBeGreaterThan(slug === "index" ? 800 : 600);
      expect(readFileSync(join(docs, `${slug}.mdx`), "utf8")).toMatch(/^---\ntitle: .+\ndescription: (?!TODO).+\n/);
    });
  }
});

describe("docs code blocks", () => {
  const files = walk(docs);
  const blocks = files.flatMap(canonBlocks);

  it("there are Canon examples to check", () => {
    expect(blocks.length).toBeGreaterThan(40);
  });

  for (const f of files) {
    const named = new Map<string, string>();
    for (const b of canonBlocks(f)) {
      const name = attr(b.meta, "name");
      const include = attr(b.meta, "include");
      const prefix = include ? named.get(include) : undefined;
      it(`${relative(docs, f)}:${b.line}`, () => {
        if (include) expect(prefix, `include=${include} names no earlier block`).toBeDefined();
        const src = prefix ? `${prefix}\n${b.code}` : b.code;
        // a block marked syntax=py is Canon-Py, checked as `canon check --syntax py` does
        const r = check(src, "example.cn", attr(b.meta, "syntax") === "py" ? { features: V04_PY } : {});
        const want = /# expect: (\w+)/.exec(b.code)?.[1];
        if (want) {
          expect(r.ok, src).toBe(false);
          expect(r.diagnostics.map((d) => d.code), src).toContain(want);
        } else {
          expect(r.diagnostics, src).toEqual([]);
        }
      });
      if (name) named.set(name, prefix ? `${prefix}\n${b.code}` : b.code);
    }
  }
});

describe("/llms.txt", () => {
  it("is the For agents page as plain text, under 4,000 tokens", () => {
    const text = agentReference();
    expect(text.length / 3.5).toBeLessThan(4000);
    expect(text.length).toBeGreaterThan(3000);
    expect(text).not.toMatch(/^---/);
  });

  it("/llms-py.txt is the Canon-Py reference, under 4,000 tokens, and its samples are Canon-Py", () => {
    const text = agentReference("py");
    expect(text.length / 3.5).toBeLessThan(4000);
    expect(text.length).toBeGreaterThan(3000);
    expect(text).not.toMatch(/^---/);
    const blocks = canonBlocks(join(docs, "for-agents-py.mdx"));
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const b of blocks) expect(b.meta).toContain("syntax=py");
  });

  it("both references have the same sections in the same order (only the language differs)", () => {
    const heads = (t: string) => t.split("\n").filter((l) => l.startsWith("## "));
    expect(heads(agentReference("py"))).toEqual(heads(agentReference()));
  });
});
