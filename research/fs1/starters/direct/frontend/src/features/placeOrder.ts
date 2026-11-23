import { call } from "../api/client";
import type { Line, Order } from "../api/types";
import type { Outcome } from "./result";

/** Place an order for a customer. */
export async function placeOrder(baseUrl: string, email: string, lines: Line[]): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", "/orders", { body: { email, lines } });
}
