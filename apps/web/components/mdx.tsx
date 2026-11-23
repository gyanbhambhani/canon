import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Terminal } from "@/components/site/terminal";
import { Window } from "@/components/site/window";
import { siteData } from "@/lib/site";

/** The hero transcript (real CLI output, generated at build time) for use in docs pages. */
function HeroTerminal() {
  return (
    <Window title="terminal" className="not-prose my-6">
      <Terminal lines={siteData.terminal.lines} />
    </Window>
  );
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    HeroTerminal,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
