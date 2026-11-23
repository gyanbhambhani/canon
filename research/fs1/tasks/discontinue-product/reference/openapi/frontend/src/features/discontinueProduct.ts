import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Discontinue a product: it disappears from the product lists. */
export async function discontinueProduct(baseUrl: string, sku: string): Promise<Outcome<Schemas["Product"]>> {
  return attempt(() => api(baseUrl).POST("/products/{sku}/discontinue", { params: { path: { sku } } }));
}
