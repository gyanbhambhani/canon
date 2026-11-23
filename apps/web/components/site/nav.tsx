import Link from "next/link";
import { githubUrl } from "@/lib/shared";
import { GitHubMark } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/play", label: "Playground" },
  { href: "/research", label: "Benchmark" },
  { href: "/docs/agents", label: "For agents" },
];

/** The top bar on the landing page, /research and the playground. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-6" aria-label="Main">
        <Link href="/" aria-label="Canon home" className="shrink-0">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-5 text-[14px] text-muted md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors hover:text-ink-strong">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {githubUrl ? (
            <a
              href={githubUrl}
              className="hidden h-9 items-center gap-2 rounded-[10px] border border-rule-strong px-3 text-[14px] text-ink transition-colors hover:text-ink-strong sm:inline-flex"
            >
              <GitHubMark />
              GitHub
            </a>
          ) : null}
          <Link
            href="/docs/quickstart"
            className="inline-flex h-9 items-center rounded-[10px] bg-ink px-3.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>
      <ul className="flex items-center gap-5 overflow-x-auto border-t border-rule px-6 py-2 text-[14px] text-muted md:hidden">
        {NAV_LINKS.map((l) => (
          <li key={l.href} className="shrink-0">
            <Link href={l.href} className="hover:text-ink-strong">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </header>
  );
}
