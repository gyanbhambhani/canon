import { call } from "../api/client";
import type { Pending } from "../api/types";
import type { Outcome } from "./result";

/** Register an account; it stays pending until confirmSignup redeems the token. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<Outcome<Pending>> {
  return call<Pending>(baseUrl, "POST", "/users", { body: { email, name, password } });
}
