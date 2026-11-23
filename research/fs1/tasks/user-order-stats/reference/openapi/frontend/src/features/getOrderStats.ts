import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** How many orders a user placed, and how much they paid. */
export async function getOrderStats(baseUrl: string, email: string): Promise<Outcome<Schemas["OrderStats"]>> {
  return attempt(() => api(baseUrl).GET("/users/{email}/stats", { params: { path: { email } } }));
}
