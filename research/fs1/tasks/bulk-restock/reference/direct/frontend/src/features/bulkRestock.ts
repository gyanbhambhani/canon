import { call } from "../api/client";
import type { Product, RestockItem } from "../api/types";
import type { Outcome } from "./result";

/** Restock several products in one request: all of them, or none. */
export async function bulkRestock(baseUrl: string, items: RestockItem[]): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "POST", "/restock", { body: { items } });
}
