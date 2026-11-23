import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** Browse the catalog within a price range, cheapest first. */
export async function productsInPriceRange(
  baseUrl: string,
  minCents: number,
  maxCents: number,
): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).productsInPriceRange(minCents, maxCents);
}
