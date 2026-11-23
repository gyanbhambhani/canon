import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Log in; a wrong email or password is the error BadLogin. */
export async function login(baseUrl: string, email: string, password: string): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() => api(baseUrl).POST("/login", { body: { email, password } }));
}
