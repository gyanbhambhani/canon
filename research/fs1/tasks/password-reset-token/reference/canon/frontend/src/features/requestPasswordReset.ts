import { createClient } from "../canon/client";
import type { ResetToken } from "../canon/types";
import type { Outcome } from "./result";

/** Issue a one-time password reset token for an account. */
export async function requestPasswordReset(baseUrl: string, email: string): Promise<Outcome<ResetToken>> {
  return createClient(baseUrl).requestReset(email);
}
