import { createClient } from "../canon/client";
import type { Band } from "../canon/types";
import type { Outcome } from "./result";

/** Create a temperature band. */
export async function createBand(baseUrl: string, input: Band): Promise<Outcome<Band>> {
  return createClient(baseUrl).createBand(input);
}
