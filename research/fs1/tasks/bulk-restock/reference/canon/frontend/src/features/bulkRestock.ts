import { createClient } from "../canon/client";
import type { Product, RestockItem } from "../canon/types";
import type { Outcome } from "./result";

/** Restock several products in one request: all of them, or none. */
export async function bulkRestock(baseUrl: string, items: RestockItem[]): Promise<Outcome<Product[]>> {
  return createClient(baseUrl).bulkRestock({ items });
}
