import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** The other products sharing a tag with this one, most shared tags first. */
export async function relatedProducts(baseUrl: string, sku: string): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", `/products/${encodeURIComponent(sku)}/related`);
}
