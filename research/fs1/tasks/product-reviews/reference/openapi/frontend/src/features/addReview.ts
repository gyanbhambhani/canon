import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Review a product: a rating from 1 to 5 and some text. */
export async function addReview(
  baseUrl: string,
  sku: string,
  rating: number,
  text: string,
): Promise<Outcome<Schemas["Review"]>> {
  return attempt(() => api(baseUrl).POST("/products/{sku}/reviews", { params: { path: { sku } }, body: { rating, text } }));
}
