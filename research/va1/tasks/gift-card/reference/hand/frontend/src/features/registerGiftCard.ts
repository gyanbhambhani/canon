import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface GiftCard {
  code: string;
  amount: number;
  currency: string;
}

const CURRENCIES = ["USD", "EUR", "GBP"];

/** Register a gift card. */
export async function registerGiftCard(baseUrl: string, input: GiftCard): Promise<Outcome<GiftCard>> {
  const length = [...input.code].length;
  if (length < 8 || length > 12) return invalid("code must have 8 to 12 characters");
  if (!Number.isInteger(input.amount) || input.amount < 5 || input.amount > 500) return invalid("amount must be from 5 to 500");
  if (!CURRENCIES.includes(input.currency)) return invalid("currency must be USD, EUR or GBP");
  return call(baseUrl, "POST", "/gift-cards", input);
}
