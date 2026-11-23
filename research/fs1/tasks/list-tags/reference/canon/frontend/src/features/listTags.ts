import { createClient } from "../canon/client";
import type { Outcome } from "./result";

/** The tag menu: every tag in the catalog, sorted. */
export async function listTags(baseUrl: string): Promise<Outcome<string[]>> {
  return createClient(baseUrl).listTags();
}
