import { call } from "../api/client";
import type { Outcome } from "./result";

/** Every tag in the catalog, once each, sorted. */
export async function listTags(baseUrl: string): Promise<Outcome<string[]>> {
  return call<string[]>(baseUrl, "GET", "/tags");
}
