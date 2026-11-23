import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** Add a product to the catalog. */
export async function addProduct(baseUrl: string, product: Product): Promise<Outcome<Product>> {
  return createClient(baseUrl).addProduct(product);
}
