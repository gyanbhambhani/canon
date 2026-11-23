import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface PageSettings {
  size: number;
  sort: string;
}

/** Set the page size. */
export async function setPageSize(baseUrl: string, input: PageSettings): Promise<Outcome<PageSettings>> {
  if (input.size < 10 || input.size > 100) return invalid("size must be from 10 to 100");
  if (input.sort !== "asc" && input.sort !== "desc") return invalid("sort must be asc or desc");
  return call(baseUrl, "POST", "/settings/paging", input);
}
