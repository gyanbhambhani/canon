import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Create an account. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "POST", "/users", { body: { email, name, password } });
}
