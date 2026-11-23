import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Band {
  low: number;
  high: number;
  label: string;
}

/** Create a temperature band. */
export async function createBand(baseUrl: string, input: Band): Promise<Outcome<Band>> {
  if (input.low < -50 || input.low > 50) return invalid("low must be from -50 to 50");
  if (input.high < -50 || input.high > 50) return invalid("high must be from -50 to 50");
  if (input.high - input.low < 2) return invalid("high must be at least 2 more than low");
  if ([...input.label].length > 20) return invalid("label must have at most 20 characters");
  return call(baseUrl, "POST", "/bands", input);
}
