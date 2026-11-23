import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Every order with one status (Open, Paid or Cancelled), oldest first. */
export async function listOrdersByStatus(baseUrl: string, status: string): Promise<Outcome<Order[]>> {
  return call<Order[]>(baseUrl, "GET", "/orders/by-status", { query: { status } });
}
