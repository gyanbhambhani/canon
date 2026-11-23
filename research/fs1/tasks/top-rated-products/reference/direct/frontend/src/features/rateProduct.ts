import { call } from "../api/client";
import type { NewRating, RatingSummary } from "../api/types";
import type { Outcome } from "./result";

/** Rate a product from 1 to 5 stars; returns its updated rating summary. */
export async function rateProduct(baseUrl: string, sku: string, stars: number): Promise<Outcome<RatingSummary>> {
  const body: NewRating = { stars };
  return call<RatingSummary>(baseUrl, "POST", `/products/${encodeURIComponent(sku)}/ratings`, { body });
}
