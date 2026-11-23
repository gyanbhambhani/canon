import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Remove a product's line from an open order. */
export async function removeLine(baseUrl: string, orderId: number, sku: string): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "DELETE", `/orders/${orderId}/lines/${encodeURIComponent(sku)}`);
}
