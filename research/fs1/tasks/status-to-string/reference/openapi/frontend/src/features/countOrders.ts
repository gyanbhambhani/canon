import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

type Status = Schemas["Order"]["status"];
const STATUSES: readonly string[] = ["open", "paid", "cancelled"] satisfies Status[];

function isStatus(s: string): s is Status {
  return STATUSES.includes(s);
}

/** How many of a customer's orders have a status ("open", "paid" or "cancelled"). */
export async function countOrders(baseUrl: string, email: string, status: string): Promise<Outcome<number>> {
  if (!isStatus(status)) return { ok: false, error: { kind: "ValidationError" } };
  return attempt(() => api(baseUrl).GET("/orders/count", { params: { query: { email, status } } }));
}
