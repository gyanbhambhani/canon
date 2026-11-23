import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Ship a paid order with its tracking number. */
export async function shipOrder(baseUrl: string, orderId: number, tracking: string): Promise<Outcome<Order>> {
  return createClient(baseUrl).ship(orderId, { tracking });
}
