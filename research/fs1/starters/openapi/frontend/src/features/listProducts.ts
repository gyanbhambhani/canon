import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One page of the catalog, optionally only the products with a tag. */
export async function listProducts(
  baseUrl: string,
  tag: string | null,
  page: number,
  perPage: number,
): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() => api(baseUrl).GET("/products", { params: { query: { tag, page, per_page: perPage } } }));
}
