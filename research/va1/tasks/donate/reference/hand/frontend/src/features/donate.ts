import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Donation {
  amount: number;
  currency: string;
  anonymous: boolean;
}

const CURRENCIES = ["USD", "EUR"];

/** Make a donation. */
export async function donate(baseUrl: string, input: Donation): Promise<Outcome<Donation>> {
  if (!(input.amount >= 1 && input.amount <= 5000)) return invalid("amount must be from 1.0 to 5000.0");
  if (!CURRENCIES.includes(input.currency)) return invalid("currency must be USD or EUR");
  return call(baseUrl, "POST", "/donations", input);
}
