import { call } from "../api/client";
import type { TagCount } from "../api/types";
import type { Outcome } from "./result";

/** Each tag with the number of products that have it, sorted by tag. */
export async function productCountByTag(baseUrl: string): Promise<Outcome<TagCount[]>> {
  return call<TagCount[]>(baseUrl, "GET", "/tags/counts");
}
