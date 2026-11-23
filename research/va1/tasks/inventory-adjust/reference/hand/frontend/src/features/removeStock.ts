import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface StockRemoval {
  on_hand: number;
  remove: number;
  reason: string;
}

export interface StockResult extends StockRemoval {
  left: number;
}

const REASONS = ["sold", "damaged", "lost"];

/** Remove stock. */
export async function removeStock(baseUrl: string, input: StockRemoval): Promise<Outcome<StockResult>> {
  if (!Number.isInteger(input.on_hand) || input.on_hand < 0 || input.on_hand > 100000) return invalid("on_hand must be from 0 to 100000");
  if (!Number.isInteger(input.remove) || input.remove < 1) return invalid("remove must be at least 1");
  if (!REASONS.includes(input.reason)) return invalid("reason must be sold, damaged or lost");
  if (input.remove > input.on_hand) return invalid("remove must not exceed on_hand");
  return call(baseUrl, "POST", "/inventory/remove", input);
}
