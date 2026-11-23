import { createClient } from "../canon/client";
import type { TagCount } from "../canon/types";
import type { Outcome } from "./result";

/** The tag menu with counts: how many products have each tag. */
export async function productCountByTag(baseUrl: string): Promise<Outcome<TagCount[]>> {
  return createClient(baseUrl).productCountByTag();
}
