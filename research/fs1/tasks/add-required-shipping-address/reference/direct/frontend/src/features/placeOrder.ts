import { call } from "../api/client";
import type { Line, NewOrder, Order } from "../api/types";
import type { Outcome } from "./result";

/** Place an order for a customer, shipped to an address. */
export async function placeOrder(
  baseUrl: string,
  email: string,
  lines: Line[],
  shippingAddress: string,
): Promise<Outcome<Order>> {
  const body: NewOrder = { email, lines, shipping_address: shippingAddress };
  return call<Order>(baseUrl, "POST", "/orders", { body });
}
