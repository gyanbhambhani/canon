import { call } from "../api/client";
import type { Profile, Signup } from "../api/types";
import type { Outcome } from "./result";

/** Create an account. */
export async function signup(
  baseUrl: string,
  email: string,
  fullName: string,
  password: string,
): Promise<Outcome<Profile>> {
  const body: Signup = { email, full_name: fullName, password };
  return call<Profile>(baseUrl, "POST", "/users", { body });
}
