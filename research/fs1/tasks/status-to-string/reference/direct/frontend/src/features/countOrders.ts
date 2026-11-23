import { call } from "../api/client";
import type { Outcome } from "./result";

/** How many of a customer's orders have a status ("open", "paid" or "cancelled"). */
export async function countOrders(baseUrl: string, email: string, status: string): Promise<Outcome<number>> {
  return call<number>(baseUrl, "GET", "/orders/count", { query: { email, status } });
}
