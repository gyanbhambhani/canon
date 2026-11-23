import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A product's price as text, like $19.99. */
export async function productPriceLabel(baseUrl: string, sku: string): Promise<Outcome<Schemas["PriceLabel"]>> {
  return attempt(() => api(baseUrl).GET("/products/{sku}/label", { params: { path: { sku } } }));
}
