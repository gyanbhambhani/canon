import { call } from "../api/client";
import type { Revenue } from "../api/types";
import type { Outcome } from "./result";

/** Paid revenue per customer, largest first. */
export async function revenueReport(baseUrl: string): Promise<Outcome<Revenue[]>> {
  return call<Revenue[]>(baseUrl, "GET", "/reports/revenue");
}
