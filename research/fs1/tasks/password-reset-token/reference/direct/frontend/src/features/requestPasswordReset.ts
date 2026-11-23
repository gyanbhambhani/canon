import { call } from "../api/client";
import type { ResetToken } from "../api/types";
import type { Outcome } from "./result";

/** Issue a one-time password reset token for an account. */
export async function requestPasswordReset(baseUrl: string, email: string): Promise<Outcome<ResetToken>> {
  return call<ResetToken>(baseUrl, "POST", `/users/${encodeURIComponent(email)}/reset`);
}
