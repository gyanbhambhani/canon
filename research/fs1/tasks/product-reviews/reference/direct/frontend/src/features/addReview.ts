import { call } from "../api/client";
import type { NewReview, Review } from "../api/types";
import type { Outcome } from "./result";

/** Review a product: a rating from 1 to 5 and some text. */
export async function addReview(baseUrl: string, sku: string, rating: number, text: string): Promise<Outcome<Review>> {
  const body: NewReview = { rating, text };
  return call<Review>(baseUrl, "POST", `/products/${encodeURIComponent(sku)}/reviews`, { body });
}
