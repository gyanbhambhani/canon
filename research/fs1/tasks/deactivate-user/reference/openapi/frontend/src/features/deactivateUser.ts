import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Deactivate an account: it can no longer log in or place orders. */
export async function deactivateUser(baseUrl: string, email: string): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/users/{email}/deactivate", { params: { path: { email } } }));
}
