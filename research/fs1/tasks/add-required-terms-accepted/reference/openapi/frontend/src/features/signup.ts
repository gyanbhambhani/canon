import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Create an account; the customer must accept the terms. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  termsAccepted: boolean,
): Promise<Outcome<Schemas["Profile"]>> {
  return attempt(() =>
    api(baseUrl).POST("/users", { body: { email, name, password, terms_accepted: termsAccepted } }),
  );
}
