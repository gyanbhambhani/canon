import { createClient } from "../canon/client";
import type { Setting } from "../canon/types";
import type { Outcome } from "./result";

/** Set the thermostat. */
export async function setThermostat(baseUrl: string, input: Setting): Promise<Outcome<Setting>> {
  return createClient(baseUrl).setThermostat(input);
}
