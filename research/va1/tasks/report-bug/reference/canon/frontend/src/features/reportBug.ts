import { createClient } from "../canon/client";
import type { BugReport } from "../canon/types";
import type { Outcome } from "./result";

/** Report a bug. */
export async function reportBug(baseUrl: string, input: BugReport): Promise<Outcome<BugReport>> {
  return createClient(baseUrl).reportBug(input);
}
