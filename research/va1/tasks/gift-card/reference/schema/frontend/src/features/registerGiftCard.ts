import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type GiftCard = components["schemas"]["GiftCard"];

/** Register a gift card. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function registerGiftCard(baseUrl: string, input: GiftCard): Promise<Outcome<GiftCard>> {
  return send(baseUrl, "POST", "/gift-cards", "GiftCard", input);
}
