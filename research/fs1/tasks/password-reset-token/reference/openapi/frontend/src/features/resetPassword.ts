import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Redeem a password reset token, setting a new password. */
export async function resetPassword(
  baseUrl: string,
  token: string,
  newPassword: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/password-resets", { body: { token, new_password: newPassword } }));
}
