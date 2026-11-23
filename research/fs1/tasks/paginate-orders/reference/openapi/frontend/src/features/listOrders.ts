import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One page of a customer's orders, oldest first. */
export async function listOrders(
  baseUrl: string,
  email: string,
  page: number,
  perPage: number,
): Promise<Outcome<Schemas["Order"][]>> {
  return attempt(() => api(baseUrl).GET("/orders", { params: { query: { email, page, per_page: perPage } } }));
}
