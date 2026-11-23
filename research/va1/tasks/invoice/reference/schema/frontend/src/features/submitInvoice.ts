import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Invoice = components["schemas"]["Invoice"];

/** Submit an invoice. The schema carries the single-field rules; the sum rule is written here too. */
export async function submitInvoice(baseUrl: string, input: Invoice): Promise<Outcome<Invoice>> {
  return send(baseUrl, "POST", "/invoices", "Invoice", input, (i: Invoice) => {
    if (i.subtotal + i.tax + i.shipping !== i.total) return "total must equal subtotal + tax + shipping";
    return null;
  });
}
