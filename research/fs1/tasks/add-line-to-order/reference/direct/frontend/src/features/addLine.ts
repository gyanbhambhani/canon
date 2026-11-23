import { call } from "../api/client";
import type { Line, Order } from "../api/types";
import type { Outcome } from "./result";

/** Add a product to an open order (or more of a product it already has). */
export async function addLine(
  baseUrl: string,
  orderId: number,
  sku: string,
  quantity: number,
): Promise<Outcome<Order>> {
  const line: Line = { sku, quantity };
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/lines`, { body: line });
}
