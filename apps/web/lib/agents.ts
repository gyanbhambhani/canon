import { siteUrl } from "./shared";

/** The one-line way to try Canon, and the two lines that tell an agent how to use it. */
export const INSTALL_CMD = "npx canon-lang run hello.cn";
export const AGENTS_MD = `Canon reference: ${siteUrl}/llms.txt\nRun \`canon check --json\` and apply every fix.`;
