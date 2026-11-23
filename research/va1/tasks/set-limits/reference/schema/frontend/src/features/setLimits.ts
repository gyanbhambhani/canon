import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Limits = components["schemas"]["Limits"];

/** Set spending limits. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function setLimits(baseUrl: string, input: Limits): Promise<Outcome<Limits>> {
  return send(baseUrl, "POST", "/limits", "Limits", input);
}
