import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Every order with one status (Open, Paid or Cancelled), oldest first. */
export async function listOrdersByStatus(baseUrl: string, status: string): Promise<Outcome<Schemas["Order"][]>> {
  return attempt(() => api(baseUrl).GET("/orders/by-status", { params: { query: { status } } }));
}
