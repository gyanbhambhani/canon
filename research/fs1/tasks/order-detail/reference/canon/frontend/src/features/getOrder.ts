import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** One order, by id. */
export async function getOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return createClient(baseUrl).getOrder(orderId);
}
