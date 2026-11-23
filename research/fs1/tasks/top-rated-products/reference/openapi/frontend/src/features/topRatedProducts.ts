import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** The best-rated products, highest average first. */
export async function topRatedProducts(baseUrl: string, limit: number): Promise<Outcome<Schemas["TopRated"][]>> {
  return attempt(() => api(baseUrl).GET("/top-rated", { params: { query: { limit } } }));
}
