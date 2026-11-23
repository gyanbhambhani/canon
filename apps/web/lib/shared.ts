export const appName = "Canon";
export const docsRoute = "/docs";
export const siteUrl = "https://canon-lake.vercel.app";
export const npmUrl = "https://www.npmjs.com/package/canon-lang";
export const tagline = "The programming language for AI agents.";
export const subhead = "Typed, compiled, and small enough to fit in a single prompt. Every compiler error ships with its fix.";

/** The repository link comes from the environment; when it is unset, GitHub links are hidden. */
export const githubUrl: string | undefined = process.env.NEXT_PUBLIC_GITHUB_URL || undefined;

/** Source links on /research and in the docs point at the repository's files. */
export const repoUrl = "https://github.com/gyanbhambhani/canon";
export const blob = (path: string) => `${repoUrl}/blob/main/${path}`;
export const tree = (path: string) => `${repoUrl}/tree/main/${path}`;
export const commit = (sha: string) => `${repoUrl}/commit/${sha}`;
