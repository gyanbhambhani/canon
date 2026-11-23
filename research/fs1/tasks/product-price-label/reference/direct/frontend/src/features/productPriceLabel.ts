import { call } from "../api/client";
import type { PriceLabel } from "../api/types";
import type { Outcome } from "./result";

/** A product's price as text, like $19.99. */
export async function productPriceLabel(baseUrl: string, sku: string): Promise<Outcome<PriceLabel>> {
  return call<PriceLabel>(baseUrl, "GET", `/products/${encodeURIComponent(sku)}/label`);
}
