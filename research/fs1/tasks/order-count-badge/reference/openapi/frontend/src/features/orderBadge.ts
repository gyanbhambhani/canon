import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

export type Badge = Schemas["Badge"];

/** A user's open-order badge: how many orders are open, and a label for it. */
export async function orderBadge(baseUrl: string, email: string): Promise<Outcome<Badge>> {
  return attempt(() => api(baseUrl).GET("/users/{email}/badge", { params: { path: { email } } }));
}
