import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Remove a product's line from an open order. */
export async function removeLine(baseUrl: string, orderId: number, sku: string): Promise<Outcome<Order>> {
  return createClient(baseUrl).removeLine(orderId, sku);
}
