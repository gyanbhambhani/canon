import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Apply a discount code to an open order. */
export async function applyDiscount(baseUrl: string, orderId: number, code: string): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/discount", { params: { path: { id: orderId } }, body: { code } }));
}
