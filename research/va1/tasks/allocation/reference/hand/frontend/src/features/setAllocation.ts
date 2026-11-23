import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Allocation {
  ads: number;
  dev: number;
  ops: number;
  project: string;
}

/** Set a budget allocation. */
export async function setAllocation(baseUrl: string, input: Allocation): Promise<Outcome<Allocation>> {
  for (const [name, share] of [["ads", input.ads], ["dev", input.dev], ["ops", input.ops]] as const) {
    if (share < 0 || share > 100) return invalid(`${name} must be from 0 to 100`);
  }
  if (input.ads + input.dev + input.ops !== 100) return invalid("ads + dev + ops must be 100");
  const length = [...input.project].length;
  if (length < 1 || length > 30) return invalid("project must have 1 to 30 characters");
  return call(baseUrl, "POST", "/allocations", input);
}
