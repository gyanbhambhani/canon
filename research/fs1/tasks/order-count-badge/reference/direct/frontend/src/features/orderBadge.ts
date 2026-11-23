import { call } from "../api/client";
import type { Badge } from "../api/types";
import type { Outcome } from "./result";

/** A user's open-order badge: how many orders are open, and a label for it. */
export async function orderBadge(baseUrl: string, email: string): Promise<Outcome<Badge>> {
  return call<Badge>(baseUrl, "GET", `/users/${encodeURIComponent(email)}/badge`);
}
