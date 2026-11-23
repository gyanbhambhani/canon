import { call } from "../api/client";
import type { LowStock } from "../api/types";
import type { Outcome } from "./result";

/** The products with fewer than `below` in stock, lowest stock first. */
export async function lowStockReport(baseUrl: string, below: number): Promise<Outcome<LowStock[]>> {
  return call<LowStock[]>(baseUrl, "GET", "/low-stock", { query: { below } });
}
