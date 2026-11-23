import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** One page of the catalog, optionally only the products with a tag. */
export async function listProducts(
  baseUrl: string,
  tag: string | null,
  page: number,
  perPage: number,
): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", "/products", { query: { tag, page, per_page: perPage } });
}
