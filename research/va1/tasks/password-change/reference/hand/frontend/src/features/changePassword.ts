import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface PasswordChange {
  old_password: string;
  new_password: string;
  confirm: string;
}

export interface PasswordChanged {
  changed: boolean;
}

/** Change a password. */
export async function changePassword(baseUrl: string, input: PasswordChange): Promise<Outcome<PasswordChanged>> {
  if ([...input.old_password].length < 1) return invalid("old_password is required");
  if ([...input.new_password].length < 8) return invalid("new_password must have at least 8 characters");
  if (input.confirm !== input.new_password) return invalid("confirm must equal new_password");
  if (input.new_password === input.old_password) return invalid("new_password must differ from old_password");
  return call(baseUrl, "POST", "/password", input);
}
