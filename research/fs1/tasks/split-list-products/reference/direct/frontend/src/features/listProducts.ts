import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** One page of the whole catalog, by SKU. */
export async function listProducts(baseUrl: string, page: number, perPage: number): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", "/products", { query: { page, per_page: perPage } });
}
