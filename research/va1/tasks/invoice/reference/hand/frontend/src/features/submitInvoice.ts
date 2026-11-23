import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Invoice {
  number: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

/** Submit an invoice. */
export async function submitInvoice(baseUrl: string, input: Invoice): Promise<Outcome<Invoice>> {
  const length = [...input.number].length;
  if (length < 1 || length > 20) return invalid("number must have 1 to 20 characters");
  for (const amount of [input.subtotal, input.tax, input.shipping, input.total]) {
    if (!Number.isInteger(amount) || amount < 0) return invalid("amounts must be at least 0");
  }
  if (input.subtotal + input.tax + input.shipping !== input.total) return invalid("total must equal subtotal + tax + shipping");
  return call(baseUrl, "POST", "/invoices", input);
}
