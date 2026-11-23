import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Log in; a wrong email or password is the error BadLogin. */
export async function login(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).login({ email, password });
}
