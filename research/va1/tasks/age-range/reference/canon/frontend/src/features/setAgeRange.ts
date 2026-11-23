import { createClient } from "../canon/client";
import type { AgeRange } from "../canon/types";
import type { Outcome } from "./result";

/** Set an age range. */
export async function setAgeRange(baseUrl: string, input: AgeRange): Promise<Outcome<AgeRange>> {
  return createClient(baseUrl).setAgeRange(input);
}
