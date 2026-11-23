import { createClient } from "../canon/client";
import type { Review } from "../canon/types";
import type { Outcome } from "./result";

/** A product's reviews, oldest first. */
export async function listReviews(baseUrl: string, sku: string): Promise<Outcome<Review[]>> {
  return createClient(baseUrl).listReviews(sku);
}
