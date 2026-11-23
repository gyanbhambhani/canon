import { call } from "../api/client";
import type { RatingSummary } from "../api/types";
import type { Outcome } from "./result";

/** A product's rating summary: the number of ratings and their average. */
export async function productRating(baseUrl: string, sku: string): Promise<Outcome<RatingSummary>> {
  return call<RatingSummary>(baseUrl, "GET", `/products/${encodeURIComponent(sku)}/rating`);
}
