import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Authorize payment for an open order (the amount is held, not taken). */
export async function authorizeOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).authorize(orderId);
}
