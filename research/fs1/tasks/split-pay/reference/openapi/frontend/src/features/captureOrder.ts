import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Capture the authorized payment of an order: the order is paid. */
export async function captureOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/capture", { params: { path: { id: orderId } } }));
}
