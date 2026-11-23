import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** One page of a customer's orders, oldest first. */
export async function listOrders(
  baseUrl: string,
  email: string,
  page: number,
  perPage: number,
): Promise<Outcome<Order[]>> {
  return call<Order[]>(baseUrl, "GET", "/orders", { query: { email, page, per_page: perPage } });
}
