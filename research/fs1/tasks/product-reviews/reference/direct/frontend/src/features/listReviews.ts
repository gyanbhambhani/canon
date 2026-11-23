import { call } from "../api/client";
import type { Review } from "../api/types";
import type { Outcome } from "./result";

/** A product's reviews, oldest first. */
export async function listReviews(baseUrl: string, sku: string): Promise<Outcome<Review[]>> {
  return call<Review[]>(baseUrl, "GET", `/products/${encodeURIComponent(sku)}/reviews`);
}
