import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** Suggestions for a product page: products that share its tags. */
export async function relatedProducts(baseUrl: string, sku: string): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).relatedProducts(sku);
}
