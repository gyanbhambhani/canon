import { createClient } from "../canon/client";
import type { Invoice } from "../canon/types";
import type { Outcome } from "./result";

/** Submit an invoice. */
export async function submitInvoice(baseUrl: string, input: Invoice): Promise<Outcome<Invoice>> {
  return createClient(baseUrl).submitInvoice(input);
}
