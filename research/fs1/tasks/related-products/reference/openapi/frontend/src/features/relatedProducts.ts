import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Suggestions for a product page: products that share its tags. */
export async function relatedProducts(baseUrl: string, sku: string): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() => api(baseUrl).GET("/products/{sku}/related", { params: { path: { sku } } }));
}
