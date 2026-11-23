import { createClient } from "../canon/client";
import type { LowStock } from "../canon/types";
import type { Outcome } from "./result";

/** What to reorder: the products with fewer than `below` in stock. */
export async function lowStockReport(baseUrl: string, below: number): Promise<Outcome<LowStock[]>> {
  return createClient(baseUrl).lowStockReport(below);
}
