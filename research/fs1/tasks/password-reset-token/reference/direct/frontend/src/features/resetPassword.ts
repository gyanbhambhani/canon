import { call } from "../api/client";
import type { PasswordReset, Profile } from "../api/types";
import type { Outcome } from "./result";

/** Redeem a password reset token, setting a new password. */
export async function resetPassword(baseUrl: string, token: string, newPassword: string): Promise<Outcome<Profile>> {
  const body: PasswordReset = { token, new_password: newPassword };
  return call<Profile>(baseUrl, "POST", "/password-resets", { body });
}
