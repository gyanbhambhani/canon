import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** The users whose name contains the search text. */
export async function searchUsers(baseUrl: string, q: string): Promise<Outcome<Schemas["Profile"][]>> {
  return attempt(() => api(baseUrl).GET("/users/search", { params: { query: { q } } }));
}
