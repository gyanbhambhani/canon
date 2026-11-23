import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Limits {
  daily: number;
  monthly: number;
}

/** Set spending limits. */
export async function setLimits(baseUrl: string, input: Limits): Promise<Outcome<Limits>> {
  if (input.daily < 1 || input.daily > 1000) return invalid("daily must be from 1 to 1000");
  if (input.monthly < 1 || input.monthly > 31000) return invalid("monthly must be from 1 to 31000");
  return call(baseUrl, "POST", "/limits", input);
}
