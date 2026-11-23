import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** Take a product off the catalog's lists; it can still be fetched by its SKU. */
export async function discontinueProduct(baseUrl: string, sku: string): Promise<Outcome<Product>> {
  return call<Product>(baseUrl, "POST", `/products/${encodeURIComponent(sku)}/discontinue`);
}
