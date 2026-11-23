import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A product's rating summary. */
export async function productRating(baseUrl: string, sku: string): Promise<Outcome<Schemas["RatingSummary"]>> {
  return attempt(() => api(baseUrl).GET("/products/{sku}/rating", { params: { path: { sku } } }));
}
