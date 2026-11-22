export const appName = "Canon";
export const docsRoute = "/docs";

/** The repository link comes from the environment; when it is unset, GitHub links are hidden. */
export const githubUrl: string | undefined = process.env.NEXT_PUBLIC_GITHUB_URL || undefined;
