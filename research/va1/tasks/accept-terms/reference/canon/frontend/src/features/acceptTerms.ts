import { createClient } from "../canon/client";
import type { Terms } from "../canon/types";
import type { Outcome } from "./result";

/** Record that a user accepted the terms. */
export async function acceptTerms(baseUrl: string, input: Terms): Promise<Outcome<Terms>> {
  return createClient(baseUrl).acceptTerms(input);
}
