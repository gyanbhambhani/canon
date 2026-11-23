import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Change a user's password; the old one must match. */
export async function changePassword(
  baseUrl: string,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() =>
    api(baseUrl).POST("/users/{email}/password", {
      params: { path: { email } },
      body: { old_password: oldPassword, new_password: newPassword },
    }),
  );
}
