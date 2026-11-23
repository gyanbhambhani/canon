import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Change a user's display name. */
export async function changeDisplayName(
  baseUrl: string,
  email: string,
  name: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).PATCH("/users/{email}", { params: { path: { email } }, body: { name } }));
}
