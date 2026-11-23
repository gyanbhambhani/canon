import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Search the catalog by part of a product name. */
export async function searchProducts(baseUrl: string, query: string): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() => api(baseUrl).GET("/search", { params: { query: { q: query } } }));
}
