import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Wordmark } from "@/components/site/wordmark";
import { NAV_LINKS } from "@/components/site/nav";
import { githubUrl } from "./shared";

/** Docs navigation: the same wordmark and links as the rest of the site. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Wordmark />, url: "/" },
    links: NAV_LINKS.filter((l) => l.href !== "/docs").map((l) => ({ text: l.label, url: l.href })),
    ...(githubUrl ? { githubUrl } : {}),
  };
}
