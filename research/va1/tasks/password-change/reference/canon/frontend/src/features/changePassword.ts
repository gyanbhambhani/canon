import { createClient } from "../canon/client";
import type { PasswordChange, PasswordChanged } from "../canon/types";
import type { Outcome } from "./result";

/** Change a password. */
export async function changePassword(baseUrl: string, input: PasswordChange): Promise<Outcome<PasswordChanged>> {
  return createClient(baseUrl).changePassword(input);
}
