import Link from "next/link";
import { githubUrl, npmUrl, tagline } from "@/lib/shared";
import { Wordmark } from "./wordmark";

type L = { label: string; href: string };
const COLUMNS: { title: string; links: (L | null)[] }[] = [
  {
    title: "Docs",
    links: [
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Language guide", href: "/docs/guide/files-and-syntax" },
      { label: "Standard library", href: "/docs/stdlib" },
      { label: "CLI", href: "/docs/cli" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "Agent guide", href: "/docs/agents" },
      { label: "llms.txt", href: "/llms.txt" },
      { label: "Playground", href: "/play" },
    ],
  },
  {
    title: "Project",
    links: [
      githubUrl ? { label: "GitHub", href: githubUrl } : null,
      { label: "npm", href: npmUrl },
      { label: "Benchmark", href: "/research" },
      { label: "Roadmap", href: "/docs/roadmap" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="frame flex flex-col gap-10 px-6 py-14 md:flex-row md:justify-between">
        <div className="space-y-3 text-[14px] text-muted">
          <Wordmark size="footer" />
          <p>{tagline}</p>
          <p className="text-faint">MIT License · Built by Gyan Bhambhani</p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-[14px] sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h2 className="mb-3 font-mono text-[13px] text-faint">{c.title}</h2>
              <ul className="space-y-2">
                {c.links.filter((l): l is L => l !== null).map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("http") || l.href.endsWith(".txt") ? (
                      <a href={l.href} className="text-muted transition-colors hover:text-ink-strong">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} prefetch={l.href === "/play" ? false : undefined} className="text-muted transition-colors hover:text-ink-strong">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
