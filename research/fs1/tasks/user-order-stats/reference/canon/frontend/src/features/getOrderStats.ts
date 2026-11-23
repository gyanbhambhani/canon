import { createClient } from "../canon/client";
import type { OrderStats } from "../canon/types";
import type { Outcome } from "./result";

/** How many orders a user placed, and how much they paid. */
export async function getOrderStats(baseUrl: string, email: string): Promise<Outcome<OrderStats>> {
  return createClient(baseUrl).orderStats(email);
}
