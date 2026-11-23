import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Every order with one status (Open, Paid or Cancelled), oldest first. */
export async function listOrdersByStatus(baseUrl: string, status: string): Promise<Outcome<Order[]>> {
  return createClient(baseUrl).ordersByStatus(status);
}
