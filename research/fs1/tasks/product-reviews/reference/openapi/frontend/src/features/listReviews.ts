import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A product's reviews, oldest first. */
export async function listReviews(baseUrl: string, sku: string): Promise<Outcome<Schemas["Review"][]>> {
  return attempt(() => api(baseUrl).GET("/products/{sku}/reviews", { params: { path: { sku } } }));
}
