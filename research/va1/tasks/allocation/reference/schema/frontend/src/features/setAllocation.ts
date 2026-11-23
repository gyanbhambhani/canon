import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Allocation = components["schemas"]["Allocation"];

/** Set a budget allocation. The schema carries the single-field rules; the total is written here too. */
export async function setAllocation(baseUrl: string, input: Allocation): Promise<Outcome<Allocation>> {
  return send(baseUrl, "POST", "/allocations", "Allocation", input, (i: Allocation) => {
    if (i.ads + i.dev + i.ops !== 100) return "ads + dev + ops must be 100";
    return null;
  });
}
