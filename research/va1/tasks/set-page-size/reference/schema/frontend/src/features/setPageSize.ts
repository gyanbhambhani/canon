import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type PageSettings = components["schemas"]["PageSettings"];

/** Set the page size. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function setPageSize(baseUrl: string, input: PageSettings): Promise<Outcome<PageSettings>> {
  return send(baseUrl, "POST", "/settings/paging", "PageSettings", input);
}
