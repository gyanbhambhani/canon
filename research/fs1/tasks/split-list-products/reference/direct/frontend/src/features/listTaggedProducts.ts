import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** One page of the products with a tag, by SKU. */
export async function listTaggedProducts(
  baseUrl: string,
  tag: string,
  page: number,
  perPage: number,
): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", `/tags/${encodeURIComponent(tag)}/products`, {
    query: { page, per_page: perPage },
  });
}
