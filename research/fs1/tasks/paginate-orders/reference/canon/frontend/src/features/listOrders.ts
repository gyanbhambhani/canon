import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** One page of a customer's orders, oldest first. */
export async function listOrders(
  baseUrl: string,
  email: string,
  page: number,
  perPage: number,
): Promise<Outcome<Order[]>> {
  return createClient(baseUrl).listOrders(email, page, perPage);
}
