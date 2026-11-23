import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Create an account with a phone number. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  phone: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/users", { body: { email, name, password, phone } }));
}
