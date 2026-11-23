import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Cancel an order that is not paid yet. */
export async function cancelOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).cancel(orderId);
}
