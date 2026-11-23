import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Change a user's display name. */
export async function changeDisplayName(baseUrl: string, email: string, name: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "PATCH", `/users/${encodeURIComponent(email)}`, { body: { name } });
}
