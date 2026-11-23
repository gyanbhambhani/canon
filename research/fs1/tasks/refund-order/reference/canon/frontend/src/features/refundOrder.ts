import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Refund a paid order through the payment provider. */
export async function refundOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).refund(orderId);
}
