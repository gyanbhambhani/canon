import { call } from "../api/client";
import type { Profile, Signup } from "../api/types";
import type { Outcome } from "./result";

/** Create an account; the customer must accept the terms. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  termsAccepted: boolean,
): Promise<Outcome<Profile>> {
  const body: Signup = { email, name, password, terms_accepted: termsAccepted };
  return call<Profile>(baseUrl, "POST", "/users", { body });
}
