import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type SignupRequest = components["schemas"]["SignupRequest"];
type Account = components["schemas"]["Account"];

/** Sign up with a password. The schema carries the single-field rules; the rule over `password` and `email` is written here too. */
export async function signUp(baseUrl: string, input: SignupRequest): Promise<Outcome<Account>> {
  return send(baseUrl, "POST", "/signup", "SignupRequest", input, (i: SignupRequest) => {
    if (i.password === i.email) return "password must differ from the email";
    return null;
  });
}
