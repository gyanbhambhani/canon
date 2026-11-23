import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A user's default shipping address, or null when none is set. */
export async function getDefaultAddress(baseUrl: string, email: string): Promise<Outcome<Schemas["Address"] | null>> {
  return attempt(() => api(baseUrl).GET("/users/{email}/default-address", { params: { path: { email } } }));
}
