import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Band = components["schemas"]["Band"];

/** Create a temperature band. The schema carries the single-field rules; the rule over `low` and `high` is written here too. */
export async function createBand(baseUrl: string, input: Band): Promise<Outcome<Band>> {
  return send(baseUrl, "POST", "/bands", "Band", input, (i: Band) => {
    if (i.high - i.low < 2) return "high must be at least 2 more than low";
    return null;
  });
}
