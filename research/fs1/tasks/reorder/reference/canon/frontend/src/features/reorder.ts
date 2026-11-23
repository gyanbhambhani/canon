import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Place a new order with the same lines as a previous one. */
export async function reorder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).reorder(orderId);
}
