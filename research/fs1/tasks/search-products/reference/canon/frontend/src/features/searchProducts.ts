import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** Search the catalog by part of a product name. */
export async function searchProducts(baseUrl: string, query: string): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).searchProducts(query);
}
