import { call } from "../api/client";
import type { Profile, Signup } from "../api/types";
import type { Outcome } from "./result";

/** Create an account with a phone number. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  phone: string,
): Promise<Outcome<Profile>> {
  const body: Signup = { email, name, password, phone };
  return call<Profile>(baseUrl, "POST", "/users", { body });
}
