import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Restock several products in one request: all of them, or none. */
export async function bulkRestock(
  baseUrl: string,
  items: Schemas["RestockItem"][],
): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() => api(baseUrl).POST("/restock", { body: { items } }));
}
