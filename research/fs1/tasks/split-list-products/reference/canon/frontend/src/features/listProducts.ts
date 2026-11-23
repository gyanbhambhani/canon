import { createClient } from "../canon/client";
import type { Product } from "../canon/types";
import type { Outcome } from "./result";

/** One page of the whole catalog. */
export async function listProducts(baseUrl: string, page: number, perPage: number): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).listProducts(page, perPage);
}
