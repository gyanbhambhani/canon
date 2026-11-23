import { createClient } from "../canon/client";
import type { PriceFilter } from "../canon/types";
import type { Outcome } from "./result";

/** Filter products by price range. */
export async function filterByPrice(baseUrl: string, input: PriceFilter): Promise<Outcome<PriceFilter>> {
  return createClient(baseUrl).filterByPrice(input);
}
