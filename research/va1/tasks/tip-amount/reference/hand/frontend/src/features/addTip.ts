import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Tip {
  amount: number;
  percent: number;
}

/** Add a tip. */
export async function addTip(baseUrl: string, input: Tip): Promise<Outcome<Tip>> {
  if (input.amount < 0.01 || input.amount > 10000.0) return invalid("amount must be from 0.01 to 10000.0");
  if (input.percent < 0 || input.percent > 100) return invalid("percent must be from 0 to 100");
  return call(baseUrl, "POST", "/tips", input);
}
