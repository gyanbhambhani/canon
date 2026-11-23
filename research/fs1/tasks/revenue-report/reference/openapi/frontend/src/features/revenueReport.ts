import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Paid revenue per customer, largest first. */
export async function revenueReport(baseUrl: string): Promise<Outcome<Schemas["Revenue"][]>> {
  return attempt(() => api(baseUrl).GET("/reports/revenue"));
}
