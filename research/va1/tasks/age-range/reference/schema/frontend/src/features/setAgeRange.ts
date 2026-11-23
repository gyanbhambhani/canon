import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type AgeRange = components["schemas"]["AgeRange"];

/** Set the age range of an event. The schema carries the single-field rules; the order of the two ages is written here too. */
export async function setAgeRange(baseUrl: string, input: AgeRange): Promise<Outcome<AgeRange>> {
  return send(baseUrl, "POST", "/events/ages", "AgeRange", input, (i: AgeRange) => {
    if (i.min_age > i.max_age) return "min_age must be at most max_age";
    return null;
  });
}
