import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Donation = components["schemas"]["Donation"];

/** Make a donation. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function donate(baseUrl: string, input: Donation): Promise<Outcome<Donation>> {
  return send(baseUrl, "POST", "/donations", "Donation", input);
}
