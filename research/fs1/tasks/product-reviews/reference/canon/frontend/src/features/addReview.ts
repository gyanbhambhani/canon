import { createClient } from "../canon/client";
import type { Review } from "../canon/types";
import type { Outcome } from "./result";

/** Review a product: a rating from 1 to 5 and some text. */
export async function addReview(baseUrl: string, sku: string, rating: number, text: string): Promise<Outcome<Review>> {
  return createClient(baseUrl).addReview(sku, { rating, text });
}
