import { createClient } from "../canon/client";
import type { Line, Order } from "../canon/types";
import type { Outcome } from "./result";

/** Place an order for a customer, shipped to an address. */
export async function placeOrder(
  baseUrl: string,
  email: string,
  lines: Line[],
  shippingAddress: string,
): Promise<Outcome<Order>> {
  return createClient(baseUrl).placeOrder({ email, lines, shipping_address: shippingAddress });
}
