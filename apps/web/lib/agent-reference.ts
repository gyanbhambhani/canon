import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The agent reference: the body of content/docs/for-agents.mdx without its frontmatter.
 * The docs page and /llms.txt share this one source, and a test keeps it under 4,000 tokens.
 */
export function agentReference(): string {
  // the web build runs in apps/web; tests and scripts run from the repository root
  const candidates = [
    join(process.cwd(), "content", "docs", "for-agents.mdx"),
    join(process.cwd(), "apps", "web", "content", "docs", "for-agents.mdx"),
  ];
  const file = candidates.find((f) => existsSync(f)) ?? candidates[0];
  const raw = readFileSync(file, "utf8");
  return stripFrontmatter(raw).trim() + "\n";
}

export function stripFrontmatter(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\n/, "");
}
