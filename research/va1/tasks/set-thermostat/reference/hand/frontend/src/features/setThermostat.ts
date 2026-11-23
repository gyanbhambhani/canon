import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Setting {
  temperature: number;
  mode: string;
}

const MODES = ["eco", "comfort", "away"];

/** Set the thermostat. */
export async function setThermostat(baseUrl: string, input: Setting): Promise<Outcome<Setting>> {
  if (!Number.isInteger(input.temperature) || input.temperature < 10 || input.temperature > 30) {
    return invalid("temperature must be from 10 to 30");
  }
  if (!MODES.includes(input.mode)) return invalid("mode must be eco, comfort or away");
  return call(baseUrl, "POST", "/thermostat", input);
}
