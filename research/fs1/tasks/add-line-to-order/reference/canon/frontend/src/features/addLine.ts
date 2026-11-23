import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Add a product to an open order (or more of a product it already has). */
export async function addLine(
  baseUrl: string,
  orderId: number,
  sku: string,
  quantity: number,
): Promise<Outcome<Order>> {
  return createClient(baseUrl).addLine(orderId, { sku, quantity });
}
