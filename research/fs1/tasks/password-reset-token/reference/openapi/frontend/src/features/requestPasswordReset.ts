import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Issue a one-time password reset token for an account. */
export async function requestPasswordReset(baseUrl: string, email: string): Promise<Outcome<Schemas["ResetToken"]>> {
  return attempt(() => api(baseUrl).POST("/users/{email}/reset", { params: { path: { email } } }));
}
