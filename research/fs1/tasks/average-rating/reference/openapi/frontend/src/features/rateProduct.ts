import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Rate a product from 1 to 5 stars. */
export async function rateProduct(
  baseUrl: string,
  sku: string,
  stars: number,
): Promise<Outcome<Schemas["RatingSummary"]>> {
  return attempt(() => api(baseUrl).POST("/products/{sku}/ratings", { params: { path: { sku } }, body: { stars } }));
}
