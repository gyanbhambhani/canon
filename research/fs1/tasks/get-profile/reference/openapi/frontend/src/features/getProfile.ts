import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** A user's profile, by email. */
export async function getProfile(baseUrl: string, email: string): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).GET("/users/{email}", { params: { path: { email } } }));
}
