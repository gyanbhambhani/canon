import { createClient } from "../canon/client";
import type { PriceLabel } from "../canon/types";
import type { Outcome } from "./result";

/** A product's price as text, like $19.99. */
export async function productPriceLabel(baseUrl: string, sku: string): Promise<Outcome<PriceLabel>> {
  return createClient(baseUrl).productPriceLabel(sku);
}
