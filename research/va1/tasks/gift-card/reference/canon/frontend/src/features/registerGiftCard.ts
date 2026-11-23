import { createClient } from "../canon/client";
import type { GiftCard } from "../canon/types";
import type { Outcome } from "./result";

/** Register a gift card. */
export async function registerGiftCard(baseUrl: string, input: GiftCard): Promise<Outcome<GiftCard>> {
  return createClient(baseUrl).registerGiftCard(input);
}
