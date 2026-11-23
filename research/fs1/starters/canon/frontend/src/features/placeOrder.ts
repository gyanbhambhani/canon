import { createClient } from "../canon/client";
import type { Line, Order } from "../canon/types";
import type { Outcome } from "./result";

/** Place an order for a customer. */
export async function placeOrder(baseUrl: string, email: string, lines: Line[]): Promise<Outcome<Order>> {
  return createClient(baseUrl).placeOrder({ email, lines });
}
