import { createClient } from "../canon/client";
import type { TopRated } from "../canon/types";
import type { Outcome } from "./result";

/** The best-rated products, highest average first. */
export async function topRatedProducts(baseUrl: string, limit: number): Promise<Outcome<TopRated[]>> {
  return createClient(baseUrl).topRated(limit);
}
