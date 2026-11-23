import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Redeem a password reset token, setting a new password. */
export async function resetPassword(baseUrl: string, token: string, newPassword: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).resetPassword({ token, new_password: newPassword });
}
