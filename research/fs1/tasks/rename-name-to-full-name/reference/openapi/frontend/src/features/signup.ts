import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Create an account. */
export async function signup(
  baseUrl: string,
  email: string,
  fullName: string,
  password: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/users", { body: { email, full_name: fullName, password } }));
}
