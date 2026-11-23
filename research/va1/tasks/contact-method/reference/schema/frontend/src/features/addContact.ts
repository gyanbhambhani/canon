import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Contact = components["schemas"]["Contact"];

/** Add a contact. The schema carries the rules on single fields; the rule over `email` and `phone` is written here too. */
export async function addContact(baseUrl: string, input: Contact): Promise<Outcome<Contact>> {
  return send(baseUrl, "POST", "/contacts", "Contact", input, (i: Contact) => {
    if (i.email === "" && i.phone === "") return "give an email or a phone";
    return null;
  });
}
