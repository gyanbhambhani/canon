import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Log in; a wrong email or password is the error BadLogin. */
export async function login(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "POST", "/login", { body: { email, password } });
}
