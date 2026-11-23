import { call } from "../api/client";
import type { TopRated } from "../api/types";
import type { Outcome } from "./result";

/** The best-rated products, highest average first. */
export async function topRatedProducts(baseUrl: string, limit: number): Promise<Outcome<TopRated[]>> {
  return call<TopRated[]>(baseUrl, "GET", "/top-rated", { query: { limit } });
}
