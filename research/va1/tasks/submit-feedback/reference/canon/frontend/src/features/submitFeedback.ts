import { createClient } from "../canon/client";
import type { Feedback } from "../canon/types";
import type { Outcome } from "./result";

/** Submit feedback. */
export async function submitFeedback(baseUrl: string, input: Feedback): Promise<Outcome<Feedback>> {
  return createClient(baseUrl).submitFeedback(input);
}
