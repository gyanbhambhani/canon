import { createClient } from "../canon/client";
import type { Revenue } from "../canon/types";
import type { Outcome } from "./result";

/** Paid revenue per customer, largest first. */
export async function revenueReport(baseUrl: string): Promise<Outcome<Revenue[]>> {
  return createClient(baseUrl).revenueReport();
}
