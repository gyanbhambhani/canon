import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One order, by id. */
export async function getOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).GET("/orders/{id}", { params: { path: { id: orderId } } }));
}
