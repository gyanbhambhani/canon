import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One page of users, sorted by email. */
export async function listUsers(baseUrl: string, page: number, perPage: number): Promise<Outcome<Schemas["Profile"][]>> {
  return attempt(() => api(baseUrl).GET("/users", { params: { query: { page, per_page: perPage } } }));
}
