import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** One page of the products with a tag. */
export async function listTaggedProducts(
  baseUrl: string,
  tag: string,
  page: number,
  perPage: number,
): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).listTaggedProducts(tag, page, perPage);
}
