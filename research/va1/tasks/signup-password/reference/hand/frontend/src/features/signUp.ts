import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface SignupRequest {
  email: string;
  password: string;
}

export interface Account {
  email: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sign up with a password. */
export async function signUp(baseUrl: string, input: SignupRequest): Promise<Outcome<Account>> {
  if (!EMAIL.test(input.email)) return invalid("email must be an email address");
  if ([...input.password].length < 8) return invalid("password must have at least 8 characters");
  if (input.password === input.email) return invalid("password must differ from the email");
  return call(baseUrl, "POST", "/signup", input);
}
