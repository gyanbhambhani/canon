import { createClient } from "../canon/client";
import type { Contact } from "../canon/types";
import type { Outcome } from "./result";

/** Add a contact. */
export async function addContact(baseUrl: string, input: Contact): Promise<Outcome<Contact>> {
  return createClient(baseUrl).addContact(input);
}
