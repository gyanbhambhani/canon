import { createClient } from "../canon/client";
import type { PageSettings } from "../canon/types";
import type { Outcome } from "./result";

/** Set the page size. */
export async function setPageSize(baseUrl: string, input: PageSettings): Promise<Outcome<PageSettings>> {
  return createClient(baseUrl).setPageSize(input);
}
