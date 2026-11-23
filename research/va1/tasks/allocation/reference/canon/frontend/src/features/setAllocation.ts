import { createClient } from "../canon/client";
import type { Allocation } from "../canon/types";
import type { Outcome } from "./result";

/** Set a budget allocation. */
export async function setAllocation(baseUrl: string, input: Allocation): Promise<Outcome<Allocation>> {
  return createClient(baseUrl).setAllocation(input);
}
