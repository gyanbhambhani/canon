import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Register an account; it stays pending until confirmSignup redeems the token. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<Outcome<Schemas["Pending"]>> {
  return attempt(() => api(baseUrl).POST("/users", { body: { email, name, password } }));
}
