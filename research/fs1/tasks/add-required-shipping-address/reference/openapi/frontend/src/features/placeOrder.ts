import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Place an order for a customer, shipped to an address. */
export async function placeOrder(
  baseUrl: string,
  email: string,
  lines: Schemas["Line"][],
  shippingAddress: string,
): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders", { body: { email, lines, shipping_address: shippingAddress } }));
}
