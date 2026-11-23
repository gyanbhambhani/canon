import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type BugReport = components["schemas"]["BugReport"];

/** Report a bug. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function reportBug(baseUrl: string, input: BugReport): Promise<Outcome<BugReport>> {
  return send(baseUrl, "POST", "/bugs", "BugReport", input);
}
