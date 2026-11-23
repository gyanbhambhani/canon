import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Tip = components["schemas"]["Tip"];

/** Add a tip. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function addTip(baseUrl: string, input: Tip): Promise<Outcome<Tip>> {
  return send(baseUrl, "POST", "/tips", "Tip", input);
}
