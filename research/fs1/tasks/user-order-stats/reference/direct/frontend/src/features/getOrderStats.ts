import { call } from "../api/client";
import type { OrderStats } from "../api/types";
import type { Outcome } from "./result";

/** How many orders a user placed, and how much they paid. */
export async function getOrderStats(baseUrl: string, email: string): Promise<Outcome<OrderStats>> {
  return call<OrderStats>(baseUrl, "GET", `/users/${encodeURIComponent(email)}/stats`);
}
