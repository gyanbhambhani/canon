import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Subscription = components["schemas"]["Subscription"];

/** Subscribe to the newsletter. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function subscribeNewsletter(baseUrl: string, input: Subscription): Promise<Outcome<Subscription>> {
  return send(baseUrl, "POST", "/newsletter", "Subscription", input);
}
