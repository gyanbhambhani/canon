import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Review = components["schemas"]["Review"];

/** Post a product review. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function postReview(baseUrl: string, input: Review): Promise<Outcome<Review>> {
  return send(baseUrl, "POST", "/reviews", "Review", input);
}
