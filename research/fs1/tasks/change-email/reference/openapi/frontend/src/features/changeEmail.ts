import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Move a user's account to a new email. */
export async function changeEmail(
  baseUrl: string,
  email: string,
  newEmail: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() =>
    api(baseUrl).PATCH("/users/{email}/email", { params: { path: { email } }, body: { new_email: newEmail } }),
  );
}
