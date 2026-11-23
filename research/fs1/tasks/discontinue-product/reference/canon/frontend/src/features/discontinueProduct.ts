import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** Discontinue a product: it disappears from the product lists. */
export async function discontinueProduct(baseUrl: string, sku: string): Promise<Outcome<Product>> {
  return createClient(baseUrl).discontinueProduct(sku);
}
