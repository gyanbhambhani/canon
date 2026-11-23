import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Poll {
  question: string;
  options: string[];
}

/** Create a poll. */
export async function createPoll(baseUrl: string, input: Poll): Promise<Outcome<Poll>> {
  const length = [...input.question].length;
  if (length < 5 || length > 120) return invalid("question must have 5 to 120 characters");
  if (input.options.length < 2 || input.options.length > 6) return invalid("options must have 2 to 6 entries");
  return call(baseUrl, "POST", "/polls", input);
}
