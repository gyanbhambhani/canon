import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Delete an account; the password confirms it. */
export async function deleteAccount(
  baseUrl: string,
  email: string,
  password: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/users/{email}/delete", { params: { path: { email } }, body: { password } }));
}
