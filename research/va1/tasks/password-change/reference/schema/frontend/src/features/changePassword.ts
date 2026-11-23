import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type PasswordChange = components["schemas"]["PasswordChange"];
type PasswordChanged = components["schemas"]["PasswordChanged"];

/** Change a password. The schema carries the length rules; the rules over several fields are written here too. */
export async function changePassword(baseUrl: string, input: PasswordChange): Promise<Outcome<PasswordChanged>> {
  return send(baseUrl, "POST", "/password", "PasswordChange", input, (i: PasswordChange) => {
    if (i.confirm !== i.new_password) return "confirm must equal new_password";
    if (i.new_password === i.old_password) return "new_password must differ from old_password";
    return null;
  });
}
