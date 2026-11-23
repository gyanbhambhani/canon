import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Confirm a pending account with the token signup returned. */
export async function confirmSignup(baseUrl: string, token: string): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/users/confirm", { body: { token } }));
}
