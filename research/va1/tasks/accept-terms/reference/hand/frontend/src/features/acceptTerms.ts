import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Terms {
  email: string;
  accepted: boolean;
}

// eslint-disable-next-line no-control-regex
const EMAIL =/^[^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+$/;

/** Record that a user accepted the terms. */
export async function acceptTerms(baseUrl: string, input: Terms): Promise<Outcome<Terms>> {
  if (!EMAIL.test(input.email)) return invalid("email must be a valid address");
  if (!input.accepted) return invalid("the terms must be accepted");
  return call(baseUrl, "POST", "/terms", input);
}
