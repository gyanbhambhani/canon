import { createClient } from "../canon/client";
import type { Limits } from "../canon/types";
import type { Outcome } from "./result";

/** Set spending limits. */
export async function setLimits(baseUrl: string, input: Limits): Promise<Outcome<Limits>> {
  return createClient(baseUrl).setLimits(input);
}
