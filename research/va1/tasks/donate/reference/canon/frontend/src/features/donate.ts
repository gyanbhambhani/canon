import { createClient } from "../canon/client";
import type { Donation } from "../canon/types";
import type { Outcome } from "./result";

/** Make a donation. */
export async function donate(baseUrl: string, input: Donation): Promise<Outcome<Donation>> {
  return createClient(baseUrl).donate(input);
}
