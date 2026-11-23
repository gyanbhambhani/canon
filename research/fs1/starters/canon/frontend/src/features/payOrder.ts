import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Pay an open order. */
export async function payOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).pay(orderId);
}
