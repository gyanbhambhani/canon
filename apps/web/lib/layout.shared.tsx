import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, githubUrl } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <span className="font-mono font-semibold tracking-tight">{appName}</span> },
    links: [
      { text: "Docs", url: "/docs" },
      { text: "Playground", url: "/play" },
    ],
    ...(githubUrl ? { githubUrl } : {}),
  };
}
