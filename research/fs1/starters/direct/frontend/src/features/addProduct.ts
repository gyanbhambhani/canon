import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** Add a product to the catalog. */
export async function addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>> {
  return call<Product>(baseUrl, "POST", "/products", { body: product });
}
