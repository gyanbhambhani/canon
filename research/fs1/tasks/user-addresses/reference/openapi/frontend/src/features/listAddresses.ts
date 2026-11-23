import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A user's addresses, oldest first. */
export async function listAddresses(baseUrl: string, email: string): Promise<Outcome<Schemas["Address"][]>> {
  return attempt(() => api(baseUrl).GET("/users/{email}/addresses", { params: { path: { email } } }));
}
