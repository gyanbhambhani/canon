import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One page of the whole catalog. */
export async function listProducts(baseUrl: string, page: number, perPage: number): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() => api(baseUrl).GET("/products", { params: { query: { page, per_page: perPage } } }));
}
