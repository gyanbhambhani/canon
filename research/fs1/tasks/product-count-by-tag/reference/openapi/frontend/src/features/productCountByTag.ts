import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** The tag menu with counts: how many products have each tag. */
export async function productCountByTag(baseUrl: string): Promise<Outcome<Schemas["TagCount"][]>> {
  return attempt(() => api(baseUrl).GET("/tags/counts"));
}
