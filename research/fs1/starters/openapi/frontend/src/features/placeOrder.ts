import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Place an order for a customer. */
export async function placeOrder(
  baseUrl: string,
  email: string,
  lines: Schemas["Line"][],
): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders", { body: { email, lines } }));
}
