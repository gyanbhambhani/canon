import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

// eslint-disable-next-line no-control-regex
const EMAIL = /^[^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+$/;

/** Add a contact. */
export async function addContact(baseUrl: string, input: Contact): Promise<Outcome<Contact>> {
  const nameLength = [...input.name].length;
  if (nameLength < 1 || nameLength > 40) return invalid("name must have 1 to 40 characters");
  if (input.email !== "" && !EMAIL.test(input.email)) return invalid("email must be empty or a valid address");
  const phoneLength = [...input.phone].length;
  if (phoneLength > 0 && (phoneLength < 7 || phoneLength > 15)) return invalid("phone must be empty or have 7 to 15 characters");
  if (input.email === "" && input.phone === "") return invalid("give an email or a phone");
  return call(baseUrl, "POST", "/contacts", input);
}
