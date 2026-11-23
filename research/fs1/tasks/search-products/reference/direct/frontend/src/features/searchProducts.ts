import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** The products whose name contains the query (ignoring the case of A to Z), sorted by SKU. */
export async function searchProducts(baseUrl: string, query: string): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", "/search", { query: { q: query } });
}
