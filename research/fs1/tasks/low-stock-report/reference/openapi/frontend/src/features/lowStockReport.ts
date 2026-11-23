import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** What to reorder: the products with fewer than `below` in stock. */
export async function lowStockReport(baseUrl: string, below: number): Promise<Outcome<Schemas["LowStock"][]>> {
  return attempt(() => api(baseUrl).GET("/low-stock", { params: { query: { below } } }));
}
