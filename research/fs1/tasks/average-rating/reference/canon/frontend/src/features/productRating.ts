import { createClient } from "../canon/client";
import type { RatingSummary } from "../canon/types";
import type { Outcome } from "./result";

/** A product's rating summary. */
export async function productRating(baseUrl: string, sku: string): Promise<Outcome<RatingSummary>> {
  return createClient(baseUrl).productRating(sku);
}
