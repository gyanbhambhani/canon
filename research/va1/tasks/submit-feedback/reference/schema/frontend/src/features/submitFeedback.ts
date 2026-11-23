import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Feedback = components["schemas"]["Feedback"];

/** Submit feedback. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function submitFeedback(baseUrl: string, input: Feedback): Promise<Outcome<Feedback>> {
  return send(baseUrl, "POST", "/feedback", "Feedback", input);
}
