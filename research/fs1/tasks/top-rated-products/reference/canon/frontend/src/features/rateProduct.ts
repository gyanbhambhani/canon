import { createClient } from "../canon/client";
import type { RatingSummary } from "../canon/types";
import type { Outcome } from "./result";

/** Rate a product from 1 to 5 stars. */
export async function rateProduct(baseUrl: string, sku: string, stars: number): Promise<Outcome<RatingSummary>> {
  return createClient(baseUrl).rateProduct(sku, { stars });
}
