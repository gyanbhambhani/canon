import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface BugReport {
  title: string;
  severity: number;
  steps: string[];
}

/** Report a bug. */
export async function reportBug(baseUrl: string, input: BugReport): Promise<Outcome<BugReport>> {
  const length = [...input.title].length;
  if (length < 5 || length > 100) return invalid("title must have 5 to 100 characters");
  if (input.severity < 1 || input.severity > 4) return invalid("severity must be from 1 to 4");
  if (input.steps.length > 10) return invalid("at most 10 steps");
  return call(baseUrl, "POST", "/bugs", input);
}
