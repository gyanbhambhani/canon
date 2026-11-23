import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Terms = components["schemas"]["Terms"];

/** Record that a user accepted the terms. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function acceptTerms(baseUrl: string, input: Terms): Promise<Outcome<Terms>> {
  return send(baseUrl, "POST", "/terms", "Terms", input);
}
