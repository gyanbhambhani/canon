import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Create an account. */
export async function signup(
  baseUrl: string,
  email: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() =>
    api(baseUrl).POST("/users", { body: { email, first_name: firstName, last_name: lastName, password } }),
  );
}
