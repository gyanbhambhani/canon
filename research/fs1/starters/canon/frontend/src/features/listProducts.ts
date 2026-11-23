import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** One page of the catalog, optionally only the products with a tag. */
export async function listProducts(
  baseUrl: string,
  tag: string | null,
  page: number,
  perPage: number,
): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).listProducts(tag, page, perPage);
}
